import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DEFAULT_STYLE_PREFIX, CHARACTERS, type CharacterDef } from "@/lib/studio";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "tom@bichay.de";

async function checkAdmin() {
  const session = await auth();
  if (!session?.user?.email || session.user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return false;
  return true;
}

// GET: Load project config (or defaults if no project exists)
export async function GET(request: Request) {
  if (!(await checkAdmin())) return Response.json({ error: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (projectId) {
    const project = await prisma.filmProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        description: true,
        stylePrompt: true,
        characters: true,
        referenceImages: true,
        style: true,
      },
    });

    if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

    return Response.json({
      ...project,
      stylePrompt: project.stylePrompt || DEFAULT_STYLE_PREFIX,
      characters: project.characters || CHARACTERS,
      isDefault: !project.stylePrompt,
    });
  }

  // No projectId — return defaults
  return Response.json({
    id: null,
    name: "KoalaTree (Standard)",
    description: "Standard KoalaTree Konfiguration",
    stylePrompt: DEFAULT_STYLE_PREFIX,
    characters: CHARACTERS,
    referenceImages: null,
    isDefault: true,
  });
}

// PUT: Update project config
export async function PUT(request: Request) {
  if (!(await checkAdmin())) return Response.json({ error: "Unauthorized" }, { status: 403 });

  const body = await request.json() as {
    projectId?: string;
    name?: string;
    description?: string;
    stylePrompt?: string | null;
    characters?: Record<string, CharacterDef> | null;
  };

  // If no projectId, create a new project
  if (!body.projectId) {
    const session = await auth();
    const project = await prisma.filmProject.create({
      data: {
        userId: session!.user!.email!,
        name: body.name || "Neues Projekt",
        description: body.description || null,
        stylePrompt: body.stylePrompt || null,
        characters: body.characters ? JSON.parse(JSON.stringify(body.characters)) : undefined,
      },
    });

    return Response.json({ project, created: true });
  }

  // Update existing project
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.stylePrompt !== undefined) data.stylePrompt = body.stylePrompt;
  if (body.characters !== undefined) {
    data.characters = body.characters ? JSON.parse(JSON.stringify(body.characters)) : null;
  }

  const project = await prisma.filmProject.update({
    where: { id: body.projectId },
    data,
  });

  return Response.json({ project });
}

// POST: Create a new project with defaults
export async function POST(request: Request) {
  if (!(await checkAdmin())) return Response.json({ error: "Unauthorized" }, { status: 403 });

  const session = await auth();
  const body = await request.json() as {
    name: string;
    description?: string;
    cloneFromId?: string;
  };

  let stylePrompt: string | null = null;
  let characters: unknown = null;

  // Clone from existing project
  if (body.cloneFromId) {
    const source = await prisma.filmProject.findUnique({
      where: { id: body.cloneFromId },
      select: { stylePrompt: true, characters: true, style: true },
    });
    if (source) {
      stylePrompt = source.stylePrompt;
      characters = source.characters;
    }
  }

  const project = await prisma.filmProject.create({
    data: {
      userId: session!.user!.email!,
      name: body.name,
      description: body.description || null,
      stylePrompt,
      characters: characters ? JSON.parse(JSON.stringify(characters)) : undefined,
    },
  });

  return Response.json({ project, created: true });
}
