import { db } from "../db";
import { dashboardLayouts, InsertDashboardLayout, DashboardLayout } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export class LayoutService {
  /**
   * Save or update a dashboard layout
   */
  static async saveLayout(userId: string, layout: InsertDashboardLayout): Promise<DashboardLayout> {
    // If this is marked as default, unset all other default layouts for this user
    if (layout.isDefault) {
      await db
        .update(dashboardLayouts)
        .set({ isDefault: false })
        .where(eq(dashboardLayouts.userId, userId));
    }

    // Check if layout with this name exists for this user
    const existing = await db
      .select()
      .from(dashboardLayouts)
      .where(
        and(
          eq(dashboardLayouts.userId, userId),
          eq(dashboardLayouts.layoutName, layout.layoutName || "My Dashboard")
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing layout
      const updated = await db
        .update(dashboardLayouts)
        .set({
          ...layout,
          updatedAt: new Date(),
        })
        .where(eq(dashboardLayouts.id, existing[0].id))
        .returning();
      
      return updated[0];
    } else {
      // Create new layout
      const inserted = await db
        .insert(dashboardLayouts)
        .values({
          ...layout,
          userId,
        })
        .returning();
      
      return inserted[0];
    }
  }

  /**
   * Get all layouts for a user
   */
  static async getUserLayouts(userId: string): Promise<DashboardLayout[]> {
    return await db
      .select()
      .from(dashboardLayouts)
      .where(eq(dashboardLayouts.userId, userId))
      .orderBy(desc(dashboardLayouts.updatedAt));
  }

  /**
   * Get the default layout for a user
   */
  static async getDefaultLayout(userId: string): Promise<DashboardLayout | null> {
    const layouts = await db
      .select()
      .from(dashboardLayouts)
      .where(
        and(
          eq(dashboardLayouts.userId, userId),
          eq(dashboardLayouts.isDefault, true)
        )
      )
      .limit(1);

    return layouts.length > 0 ? layouts[0] : null;
  }

  /**
   * Get a specific layout by ID
   */
  static async getLayoutById(userId: string, layoutId: string): Promise<DashboardLayout | null> {
    const layouts = await db
      .select()
      .from(dashboardLayouts)
      .where(
        and(
          eq(dashboardLayouts.userId, userId),
          eq(dashboardLayouts.id, layoutId)
        )
      )
      .limit(1);

    return layouts.length > 0 ? layouts[0] : null;
  }

  /**
   * Delete a layout
   */
  static async deleteLayout(userId: string, layoutId: string): Promise<boolean> {
    const result = await db
      .delete(dashboardLayouts)
      .where(
        and(
          eq(dashboardLayouts.userId, userId),
          eq(dashboardLayouts.id, layoutId)
        )
      )
      .returning();

    return result.length > 0;
  }

  /**
   * Set a layout as default
   */
  static async setDefaultLayout(userId: string, layoutId: string): Promise<DashboardLayout | null> {
    // Unset all default layouts for this user
    await db
      .update(dashboardLayouts)
      .set({ isDefault: false })
      .where(eq(dashboardLayouts.userId, userId));

    // Set the specified layout as default
    const updated = await db
      .update(dashboardLayouts)
      .set({ isDefault: true })
      .where(
        and(
          eq(dashboardLayouts.userId, userId),
          eq(dashboardLayouts.id, layoutId)
        )
      )
      .returning();

    return updated.length > 0 ? updated[0] : null;
  }

  /**
   * Export a layout as JSON
   */
  static async exportLayout(userId: string, layoutId: string): Promise<string | null> {
    const layout = await this.getLayoutById(userId, layoutId);
    
    if (!layout) {
      return null;
    }

    // Create exportable format (remove user-specific IDs)
    const exportData = {
      layoutName: layout.layoutName,
      modules: layout.modules,
      mode: layout.mode,
      exportedAt: new Date().toISOString(),
      version: "1.0",
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import a layout from JSON
   */
  static async importLayout(userId: string, jsonData: string, layoutName?: string): Promise<DashboardLayout> {
    const importData = JSON.parse(jsonData);
    
    const layout: InsertDashboardLayout = {
      userId,
      layoutName: layoutName || importData.layoutName || "Imported Layout",
      modules: importData.modules || [],
      mode: importData.mode || "simple",
      isDefault: false,
    };

    return await this.saveLayout(userId, layout);
  }
}
