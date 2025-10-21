import { db } from "../db";
import { dashboardLayouts } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { LayoutService } from "./layoutService";

export interface ActionExecutionResult {
  success: boolean;
  updatedLayout?: any;
  error?: string;
}

export class SuggestionActionExecutor {
  /**
   * Execute a suggestion action based on actionType and actionData
   */
  static async executeAction(
    userId: string,
    actionType: string,
    actionData: Record<string, any>
  ): Promise<ActionExecutionResult> {
    try {
      switch (actionType) {
        case "add_module":
          return await this.addModule(userId, actionData.moduleId);
        
        case "remove_module":
          return await this.removeModule(userId, actionData.moduleId);
        
        case "switch_mode":
          return await this.switchMode(userId, actionData.mode);
        
        case "enable_feature":
          // Future: Enable specific features
          return { success: true };
        
        case "adjust_setting":
          // Future: Adjust user settings
          return { success: true };
        
        default:
          return {
            success: false,
            error: `Unknown action type: ${actionType}`,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Add a module to the user's dashboard layout
   */
  private static async addModule(userId: string, moduleId: string): Promise<ActionExecutionResult> {
    // Get current layout
    const currentLayout = await LayoutService.getDefaultLayout(userId);
    
    if (!currentLayout) {
      // Create new layout with the module
      const newLayout = await LayoutService.saveLayout(userId, {
        layoutName: "My Dashboard",
        mode: "simple",
        modules: [moduleId],
        isDefault: true,
      });
      
      return {
        success: true,
        updatedLayout: newLayout,
      };
    }

    // Parse current modules
    const currentModules = Array.isArray(currentLayout.modules) 
      ? currentLayout.modules 
      : [];

    // Check if module is already added
    if (currentModules.includes(moduleId)) {
      return {
        success: true,
        updatedLayout: currentLayout,
      };
    }

    // Add the new module
    const updatedModules = [...currentModules, moduleId];

    // Update layout
    const updated = await db
      .update(dashboardLayouts)
      .set({
        modules: updatedModules,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(dashboardLayouts.id, currentLayout.id),
          eq(dashboardLayouts.userId, userId)
        )
      )
      .returning();

    return {
      success: true,
      updatedLayout: updated[0],
    };
  }

  /**
   * Remove a module from the user's dashboard layout
   */
  private static async removeModule(userId: string, moduleId: string): Promise<ActionExecutionResult> {
    // Get current layout
    const currentLayout = await LayoutService.getDefaultLayout(userId);
    
    if (!currentLayout) {
      return {
        success: false,
        error: "No layout found",
      };
    }

    // Parse current modules
    const currentModules = Array.isArray(currentLayout.modules) 
      ? currentLayout.modules 
      : [];

    // Remove the module
    const updatedModules = currentModules.filter((m: string) => m !== moduleId);

    // Update layout
    const updated = await db
      .update(dashboardLayouts)
      .set({
        modules: updatedModules,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(dashboardLayouts.id, currentLayout.id),
          eq(dashboardLayouts.userId, userId)
        )
      )
      .returning();

    return {
      success: true,
      updatedLayout: updated[0],
    };
  }

  /**
   * Switch dashboard mode (Simple/Power)
   */
  private static async switchMode(userId: string, mode: string): Promise<ActionExecutionResult> {
    // Get current layout
    const currentLayout = await LayoutService.getDefaultLayout(userId);
    
    if (!currentLayout) {
      // Create new layout with the specified mode
      const newLayout = await LayoutService.saveLayout(userId, {
        layoutName: "My Dashboard",
        mode,
        modules: [],
        isDefault: true,
      });
      
      return {
        success: true,
        updatedLayout: newLayout,
      };
    }

    // Update mode
    const updated = await db
      .update(dashboardLayouts)
      .set({
        mode,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(dashboardLayouts.id, currentLayout.id),
          eq(dashboardLayouts.userId, userId)
        )
      )
      .returning();

    return {
      success: true,
      updatedLayout: updated[0],
    };
  }
}
