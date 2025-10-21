import { db } from "../db";
import { chartLayouts, chartPerformanceMetrics } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export class ChartLayoutService {
  // Save chart layout
  async saveLayout(userId: string, layout: {
    layoutName?: string;
    symbol: string;
    timeframe: string;
    chartType: string;
    indicators: any[];
    drawings: any[];
    isDefault?: boolean;
  }) {
    // If setting as default, unset other defaults first
    if (layout.isDefault) {
      await db
        .update(chartLayouts)
        .set({ isDefault: false })
        .where(eq(chartLayouts.userId, userId));
    }

    // Check if layout with this name already exists
    const existingLayout = await db
      .select()
      .from(chartLayouts)
      .where(
        and(
          eq(chartLayouts.userId, userId),
          eq(chartLayouts.layoutName, layout.layoutName || "default")
        )
      )
      .limit(1);

    if (existingLayout.length > 0) {
      // Update existing layout
      const [updated] = await db
        .update(chartLayouts)
        .set({
          symbol: layout.symbol,
          timeframe: layout.timeframe,
          chartType: layout.chartType,
          indicators: layout.indicators,
          drawings: layout.drawings,
          isDefault: layout.isDefault || false,
          updatedAt: new Date(),
        })
        .where(eq(chartLayouts.id, existingLayout[0].id))
        .returning();

      return updated;
    } else {
      // Create new layout
      const [newLayout] = await db
        .insert(chartLayouts)
        .values({
          userId,
          layoutName: layout.layoutName || "default",
          symbol: layout.symbol,
          timeframe: layout.timeframe,
          chartType: layout.chartType,
          indicators: layout.indicators,
          drawings: layout.drawings,
          isDefault: layout.isDefault || false,
        })
        .returning();

      return newLayout;
    }
  }

  // Get default layout for user
  async getDefaultLayout(userId: string) {
    const [layout] = await db
      .select()
      .from(chartLayouts)
      .where(
        and(
          eq(chartLayouts.userId, userId),
          eq(chartLayouts.isDefault, true)
        )
      )
      .limit(1);

    // If no default, get most recent layout
    if (!layout) {
      const [recent] = await db
        .select()
        .from(chartLayouts)
        .where(eq(chartLayouts.userId, userId))
        .orderBy(desc(chartLayouts.updatedAt))
        .limit(1);

      return recent || null;
    }

    return layout;
  }

  // Get all layouts for user
  async getAllLayouts(userId: string) {
    return db
      .select()
      .from(chartLayouts)
      .where(eq(chartLayouts.userId, userId))
      .orderBy(desc(chartLayouts.updatedAt));
  }

  // Delete layout
  async deleteLayout(userId: string, layoutId: string) {
    const [deleted] = await db
      .delete(chartLayouts)
      .where(
        and(
          eq(chartLayouts.id, layoutId),
          eq(chartLayouts.userId, userId)
        )
      )
      .returning();

    return deleted;
  }

  // Log performance metrics
  async logPerformanceMetrics(userId: string, metrics: {
    renderTime: number;
    tickUpdateLatency: number;
    orderPreviewDelay?: number;
  }) {
    const [logged] = await db
      .insert(chartPerformanceMetrics)
      .values({
        userId,
        renderTime: metrics.renderTime,
        tickUpdateLatency: metrics.tickUpdateLatency,
        orderPreviewDelay: metrics.orderPreviewDelay,
      })
      .returning();

    return logged;
  }

  // Get average performance metrics for user
  async getPerformanceMetrics(userId: string, limit = 100) {
    const metrics = await db
      .select()
      .from(chartPerformanceMetrics)
      .where(eq(chartPerformanceMetrics.userId, userId))
      .orderBy(desc(chartPerformanceMetrics.timestamp))
      .limit(limit);

    if (metrics.length === 0) {
      return {
        avgRenderTime: 0,
        avgTickLatency: 0,
        avgOrderPreviewDelay: 0,
        sampleSize: 0,
      };
    }

    const avgRenderTime = Math.round(
      metrics.reduce((sum, m) => sum + m.renderTime, 0) / metrics.length
    );
    const avgTickLatency = Math.round(
      metrics.reduce((sum, m) => sum + m.tickUpdateLatency, 0) / metrics.length
    );
    const orderPreviewMetrics = metrics.filter(m => m.orderPreviewDelay !== null);
    const avgOrderPreviewDelay = orderPreviewMetrics.length > 0
      ? Math.round(
          orderPreviewMetrics.reduce((sum, m) => sum + (m.orderPreviewDelay || 0), 0) / orderPreviewMetrics.length
        )
      : 0;

    return {
      avgRenderTime,
      avgTickLatency,
      avgOrderPreviewDelay,
      sampleSize: metrics.length,
    };
  }
}

export const chartLayoutService = new ChartLayoutService();
