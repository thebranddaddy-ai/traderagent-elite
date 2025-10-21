import { db } from "../db";
import { layoutTelemetry, InsertLayoutTelemetry, LayoutTelemetry } from "@shared/schema";
import { eq, and, desc, gte } from "drizzle-orm";

export class TelemetryService {
  /**
   * Log a dashboard customization event
   */
  static async logEvent(event: InsertLayoutTelemetry): Promise<LayoutTelemetry> {
    const inserted = await db
      .insert(layoutTelemetry)
      .values(event)
      .returning();

    return inserted[0];
  }

  /**
   * Log module addition event
   */
  static async logModuleAdd(
    userId: string,
    moduleId: string,
    metadata?: Record<string, any>
  ): Promise<LayoutTelemetry> {
    return await this.logEvent({
      userId,
      eventType: "module_add",
      moduleId,
      metadata: metadata || {},
    });
  }

  /**
   * Log module removal event
   */
  static async logModuleRemove(
    userId: string,
    moduleId: string,
    metadata?: Record<string, any>
  ): Promise<LayoutTelemetry> {
    return await this.logEvent({
      userId,
      eventType: "module_remove",
      moduleId,
      metadata: metadata || {},
    });
  }

  /**
   * Log layout save event
   */
  static async logLayoutSave(
    userId: string,
    metadata?: Record<string, any>
  ): Promise<LayoutTelemetry> {
    return await this.logEvent({
      userId,
      eventType: "layout_save",
      metadata: metadata || {},
    });
  }

  /**
   * Log focus mode toggle event
   */
  static async logFocusModeToggle(
    userId: string,
    metadata?: Record<string, any>
  ): Promise<LayoutTelemetry> {
    return await this.logEvent({
      userId,
      eventType: "focus_mode_toggle",
      metadata: metadata || {},
    });
  }

  /**
   * Log mode switch event (Simple <-> Power)
   */
  static async logModeSwitch(
    userId: string,
    metadata?: Record<string, any>
  ): Promise<LayoutTelemetry> {
    return await this.logEvent({
      userId,
      eventType: "mode_switch",
      metadata: metadata || {},
    });
  }

  /**
   * Get all telemetry events for a user
   */
  static async getUserEvents(userId: string, limit = 100): Promise<LayoutTelemetry[]> {
    return await db
      .select()
      .from(layoutTelemetry)
      .where(eq(layoutTelemetry.userId, userId))
      .orderBy(desc(layoutTelemetry.timestamp))
      .limit(limit);
  }

  /**
   * Get telemetry events by type
   */
  static async getEventsByType(
    userId: string,
    eventType: string,
    limit = 50
  ): Promise<LayoutTelemetry[]> {
    return await db
      .select()
      .from(layoutTelemetry)
      .where(
        and(
          eq(layoutTelemetry.userId, userId),
          eq(layoutTelemetry.eventType, eventType)
        )
      )
      .orderBy(desc(layoutTelemetry.timestamp))
      .limit(limit);
  }

  /**
   * Get telemetry events for a specific module
   */
  static async getModuleEvents(
    userId: string,
    moduleId: string,
    limit = 50
  ): Promise<LayoutTelemetry[]> {
    return await db
      .select()
      .from(layoutTelemetry)
      .where(
        and(
          eq(layoutTelemetry.userId, userId),
          eq(layoutTelemetry.moduleId, moduleId)
        )
      )
      .orderBy(desc(layoutTelemetry.timestamp))
      .limit(limit);
  }

  /**
   * Get telemetry events within a time range
   */
  static async getEventsByTimeRange(
    userId: string,
    startDate: Date,
    limit = 100
  ): Promise<LayoutTelemetry[]> {
    return await db
      .select()
      .from(layoutTelemetry)
      .where(
        and(
          eq(layoutTelemetry.userId, userId),
          gte(layoutTelemetry.timestamp, startDate)
        )
      )
      .orderBy(desc(layoutTelemetry.timestamp))
      .limit(limit);
  }

  /**
   * Get telemetry analytics/summary for a user
   */
  static async getUserAnalytics(userId: string, days = 30): Promise<{
    totalEvents: number;
    moduleAdds: number;
    moduleRemoves: number;
    layoutSaves: number;
    focusToggle: number;
    modeSwitches: number;
    mostAddedModules: Array<{ moduleId: string; count: number }>;
    mostRemovedModules: Array<{ moduleId: string; count: number }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const events = await this.getEventsByTimeRange(userId, startDate, 1000);

    const moduleAdds = events.filter((e) => e.eventType === "module_add");
    const moduleRemoves = events.filter((e) => e.eventType === "module_remove");
    const layoutSaves = events.filter((e) => e.eventType === "layout_save");
    const focusToggle = events.filter((e) => e.eventType === "focus_mode_toggle");
    const modeSwitches = events.filter((e) => e.eventType === "mode_switch");

    // Count most added modules
    const addCounts: Record<string, number> = {};
    moduleAdds.forEach((e) => {
      if (e.moduleId) {
        addCounts[e.moduleId] = (addCounts[e.moduleId] || 0) + 1;
      }
    });

    // Count most removed modules
    const removeCounts: Record<string, number> = {};
    moduleRemoves.forEach((e) => {
      if (e.moduleId) {
        removeCounts[e.moduleId] = (removeCounts[e.moduleId] || 0) + 1;
      }
    });

    const mostAddedModules = Object.entries(addCounts)
      .map(([moduleId, count]) => ({ moduleId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const mostRemovedModules = Object.entries(removeCounts)
      .map(([moduleId, count]) => ({ moduleId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalEvents: events.length,
      moduleAdds: moduleAdds.length,
      moduleRemoves: moduleRemoves.length,
      layoutSaves: layoutSaves.length,
      focusToggle: focusToggle.length,
      modeSwitches: modeSwitches.length,
      mostAddedModules,
      mostRemovedModules,
    };
  }
}
