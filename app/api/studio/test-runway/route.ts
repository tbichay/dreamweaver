/**
 * Minimal Runway API test — no Kling, no Blob, no complexity.
 * GET /api/studio/test-runway → creates a test video and returns task ID
 */

export const maxDuration = 300;

export async function GET() {
  const key = process.env.RUNWAY_API_KEY;
  if (!key) return Response.json({ error: "RUNWAY_API_KEY not set" });

  try {
    // Step 1: Create task with a public image URL
    const res = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "X-Runway-Version": "2024-11-06",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gen4_turbo",
        promptImage: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=640",
        promptText: "A surfer walking on the beach at golden sunset, cinematic slow motion",
        ratio: "1280:720",
        duration: 5,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return Response.json({ error: "Runway API error", status: res.status, body: data });
    }

    // Step 2: Poll for completion
    const taskId = data.id;
    let task: any = { status: "PENDING" };
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const pollRes = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        headers: {
          "Authorization": `Bearer ${key}`,
          "X-Runway-Version": "2024-11-06",
        },
      });
      task = await pollRes.json();
      if (task.status === "SUCCEEDED" || task.status === "FAILED") break;
    }

    return Response.json({
      success: task.status === "SUCCEEDED",
      taskId,
      status: task.status,
      videoUrl: task.output?.[0],
      failure: task.failure,
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message });
  }
}
