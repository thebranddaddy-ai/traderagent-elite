import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Shadow Learning Logger
 * 
 * CEO Directive: Log all AI interactions to audit_log.jsonl for fine-tuning
 * Privacy-first: Only anonymized DNA IDs, no PII
 * Goal: Collect 100+ samples over 48 hours before fine-tuning
 */

interface ShadowLogEntry {
  timestamp: string;
  dnaId: string; // Anonymized user DNA identifier
  feature: string; // mistake_prediction, risk_check, etc.
  input_prompt: string; // Full prompt sent to AI
  model_response: string; // AI's raw response
  confidence: number; // 0-100 confidence score
  user_feedback?: 'positive' | 'negative' | 'ignored' | null; // User action
  outcome?: {
    action_taken: string; // 'heeded', 'ignored', 'modified'
    pnl?: number; // If trade executed, P&L result
    accuracy?: boolean; // Was AI correct?
  };
  metadata?: {
    symbol?: string;
    side?: string;
    quantity?: number;
    prediction_type?: string;
  };
}

class ShadowLearningLogger {
  private logPath: string;

  constructor() {
    // Store logs in server/audit_logs directory
    const logDir = path.join(process.cwd(), 'audit_logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this.logPath = path.join(logDir, 'audit_log.jsonl');
    
    console.log(`[Shadow Learning] Logging to: ${this.logPath}`);
  }

  /**
   * Generate anonymized DNA ID from user ID
   * Uses SHA-256 hash to protect privacy
   */
  private generateDnaId(userId: string): string {
    return crypto
      .createHash('sha256')
      .update(userId + 'DNA_SALT_2025')
      .digest('hex')
      .substring(0, 16); // 16-char anonymized ID
  }

  /**
   * Log AI interaction to JSONL file
   * JSONL format: one JSON object per line
   */
  async log(entry: Omit<ShadowLogEntry, 'timestamp' | 'dnaId'> & { userId: string }): Promise<void> {
    try {
      const logEntry: ShadowLogEntry = {
        timestamp: new Date().toISOString(),
        dnaId: this.generateDnaId(entry.userId),
        feature: entry.feature,
        input_prompt: entry.input_prompt,
        model_response: entry.model_response,
        confidence: entry.confidence,
        user_feedback: entry.user_feedback,
        outcome: entry.outcome,
        metadata: entry.metadata,
      };

      // Append to JSONL file (one line per entry)
      const jsonLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(this.logPath, jsonLine, 'utf8');

      console.log(`[Shadow Learning] Logged ${entry.feature} (DNA: ${logEntry.dnaId})`);
    } catch (error) {
      console.error('[Shadow Learning] Error logging entry:', error);
      // Don't throw - logging should never break main flow
    }
  }

  /**
   * Update existing log entry with outcome/feedback
   * Scans last 100 entries for matching DNA ID + feature
   */
  async updateOutcome(
    userId: string, 
    feature: string, 
    outcome: ShadowLogEntry['outcome'],
    feedback?: 'positive' | 'negative' | 'ignored'
  ): Promise<void> {
    try {
      const dnaId = this.generateDnaId(userId);
      
      if (!fs.existsSync(this.logPath)) {
        console.warn('[Shadow Learning] No log file found for update');
        return;
      }

      // Read last 100 lines (most recent entries)
      const fileContent = fs.readFileSync(this.logPath, 'utf8');
      const lines = fileContent.trim().split('\n');
      const recentLines = lines.slice(-100);
      
      let updated = false;
      const updatedLines = [...lines];

      // Find matching entry and update it
      for (let i = recentLines.length - 1; i >= 0; i--) {
        const lineIndex = lines.length - (recentLines.length - i);
        try {
          const entry = JSON.parse(recentLines[i]) as ShadowLogEntry;
          
          if (entry.dnaId === dnaId && entry.feature === feature && !entry.outcome) {
            entry.outcome = outcome;
            if (feedback) {
              entry.user_feedback = feedback;
            }
            updatedLines[lineIndex] = JSON.stringify(entry);
            updated = true;
            console.log(`[Shadow Learning] Updated outcome for ${feature} (DNA: ${dnaId})`);
            break;
          }
        } catch (parseError) {
          // Skip malformed lines
          continue;
        }
      }

      if (updated) {
        fs.writeFileSync(this.logPath, updatedLines.join('\n') + '\n', 'utf8');
      }
    } catch (error) {
      console.error('[Shadow Learning] Error updating outcome:', error);
    }
  }

  /**
   * Get log statistics
   * Returns count of entries, features, and unique users
   */
  async getStats(): Promise<{
    totalEntries: number;
    uniqueUsers: number;
    byFeature: Record<string, number>;
    withFeedback: number;
    readyForFineTuning: boolean;
  }> {
    try {
      if (!fs.existsSync(this.logPath)) {
        return {
          totalEntries: 0,
          uniqueUsers: 0,
          byFeature: {},
          withFeedback: 0,
          readyForFineTuning: false,
        };
      }

      const fileContent = fs.readFileSync(this.logPath, 'utf8');
      const lines = fileContent.trim().split('\n').filter(line => line.length > 0);
      
      const uniqueDnaIds = new Set<string>();
      const featureCounts: Record<string, number> = {};
      let feedbackCount = 0;

      lines.forEach(line => {
        try {
          const entry = JSON.parse(line) as ShadowLogEntry;
          uniqueDnaIds.add(entry.dnaId);
          featureCounts[entry.feature] = (featureCounts[entry.feature] || 0) + 1;
          if (entry.user_feedback) {
            feedbackCount++;
          }
        } catch {
          // Skip malformed lines
        }
      });

      return {
        totalEntries: lines.length,
        uniqueUsers: uniqueDnaIds.size,
        byFeature: featureCounts,
        withFeedback: feedbackCount,
        readyForFineTuning: lines.length >= 100, // CEO requirement: 100+ samples
      };
    } catch (error) {
      console.error('[Shadow Learning] Error getting stats:', error);
      throw error;
    }
  }

  /**
   * Get sample entries for debugging/review
   * Returns first N entries from the log
   */
  async getSamples(count: number = 5): Promise<ShadowLogEntry[]> {
    try {
      if (!fs.existsSync(this.logPath)) {
        return [];
      }

      const fileContent = fs.readFileSync(this.logPath, 'utf8');
      const lines = fileContent.trim().split('\n').filter(line => line.length > 0);
      
      return lines
        .slice(0, count)
        .map(line => JSON.parse(line) as ShadowLogEntry);
    } catch (error) {
      console.error('[Shadow Learning] Error getting samples:', error);
      return [];
    }
  }
}

// Singleton instance
export const shadowLearningLogger = new ShadowLearningLogger();
