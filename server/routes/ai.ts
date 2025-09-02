import { Request, Response } from "express";
import { aiService } from "../services/ai";
import { storage } from "../storage";
// No need to import requireAuth here as it's applied in routes.ts

// Voice command processing endpoint
export async function handleVoiceCommand(req: Request, res: Response) {
  try {
    const { command, timestamp, conversationHistory } = req.body;
    const userId = req.session?.userId;

    if (!command || typeof command !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: "Voice command is required" 
      });
    }

    // Get user's projects and tasks for context
    const projects = await storage.getProjects(userId!);
    const tasks = await storage.getTasks(undefined, userId!);

    // Process the voice command through AI
    const result = await aiService.processVoiceCommand(command, {
      userId: userId!,
      projects,
      tasks,
      timestamp: new Date(timestamp || Date.now()),
      conversationHistory: conversationHistory || []
    });

    res.json({
      success: true,
      response: result.response,
      action: result.action,
      dataModified: result.dataModified,
      data: result.data
    });

  } catch (error: any) {
    console.error("Voice command processing error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to process voice command" 
    });
  }
}

// Enhanced daily briefing with voice-friendly format
export async function handleVoiceBriefing(req: Request, res: Response) {
  try {
    const userId = req.session?.userId;

    // Get user's data
    const projects = await storage.getProjects(userId!);
    const tasks = await storage.getTasks(undefined, userId!);

    // Generate voice-optimized briefing
    const briefing = await aiService.generateVoiceBriefing(projects, tasks, userId!);

    res.json({
      success: true,
      briefing: briefing.text,
      spokenBriefing: briefing.spokenText,
      keyPoints: briefing.keyPoints,
      urgentItems: briefing.urgentItems
    });

  } catch (error: any) {
    console.error("Voice briefing error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to generate voice briefing" 
    });
  }
}

// Smart query processing for voice questions
export async function handleSmartQuery(req: Request, res: Response) {
  try {
    const { query, context } = req.body;
    const userId = req.session?.userId;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: "Query is required" 
      });
    }

    // Get user's data for context
    const projects = await storage.getProjects(userId!);
    const tasks = await storage.getTasks(undefined, userId!);

    // Process smart query
    const result = await aiService.processSmartQuery(query, {
      userId: userId!,
      projects,
      tasks,
      context: context || {}
    });

    res.json({
      success: true,
      answer: result.answer,
      spokenAnswer: result.spokenAnswer,
      data: result.data,
      suggestions: result.suggestions
    });

  } catch (error: any) {
    console.error("Smart query processing error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to process query" 
    });
  }
}

// Export routes without middleware applied (will be applied in routes.ts)
export const aiRoutes = [
  { path: "/voice-command", method: "POST", handler: handleVoiceCommand },
  { path: "/voice-briefing", method: "GET", handler: handleVoiceBriefing },
  { path: "/smart-query", method: "POST", handler: handleSmartQuery }
];