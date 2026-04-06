import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const emailFrom = process.env.EMAIL_FROM || "KoalaTree <noreply@koalatree.ai>";

// POST /api/profile/[id]/invite — Create invitation + send email
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { email, sichtbarkeit } = body as { email: string; sichtbarkeit?: string[] };

  if (!email || !email.includes("@")) {
    return Response.json({ error: "Gültige E-Mail erforderlich" }, { status: 400 });
  }

  // Verify ownership
  const profil = await prisma.hoererProfil.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!profil) {
    return Response.json({ error: "Profil nicht gefunden oder keine Berechtigung" }, { status: 404 });
  }

  // Check if invitation already exists
  const existing = await prisma.profilEinladung.findFirst({
    where: {
      hoererProfilId: id,
      eingeladenEmail: email.toLowerCase(),
      status: { in: ["PENDING", "ACCEPTED"] },
    },
  });

  if (existing) {
    return Response.json({ error: "Einladung für diese E-Mail existiert bereits" }, { status: 409 });
  }

  // Create invitation
  const einladung = await prisma.profilEinladung.create({
    data: {
      hoererProfilId: id,
      eingeladenEmail: email.toLowerCase(),
      eingeladenVon: session.user.id,
      sichtbarkeit: sichtbarkeit ?? ["interessen", "charaktereigenschaften"],
    },
  });

  const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://koalatree.ai";
  const inviteUrl = `${baseUrl}/einladung/${einladung.token}`;

  // Get inviter name
  const inviter = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });
  const inviterName = inviter?.name || inviter?.email || "Jemand";

  // Send invitation email
  try {
    await resend.emails.send({
      from: emailFrom,
      to: email.toLowerCase(),
      subject: `${inviterName} teilt ${profil.name}s KoalaTree-Geschichten mit dir`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #1a2e1a; color: #f5eed6; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="font-size: 24px; margin: 0 0 8px; color: #f5eed6;">KoalaTree</h1>
            <p style="color: rgba(255,255,255,0.5); font-size: 14px; margin: 0;">Personalisierte Audio-Geschichten</p>
          </div>
          <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <p style="font-size: 16px; margin: 0 0 16px; color: #f5eed6;">
              <strong>${inviterName}</strong> hat dich eingeladen, <strong>${profil.name}s</strong> Geschichten am KoalaTree anzuhören.
            </p>
            <p style="font-size: 14px; color: rgba(255,255,255,0.6); margin: 0;">
              Koda und seine Freunde erzählen personalisierte Audio-Geschichten — für Kinder und Erwachsene.
            </p>
          </div>
          <div style="text-align: center;">
            <a href="${inviteUrl}" style="display: inline-block; background: #4a7c59; color: #f5eed6; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Einladung annehmen
            </a>
          </div>
          <p style="text-align: center; font-size: 12px; color: rgba(255,255,255,0.3); margin-top: 24px;">
            Oder kopiere diesen Link: ${inviteUrl}
          </p>
        </div>
      `,
    });
  } catch (emailError) {
    console.error("Failed to send invitation email:", emailError);
    // Don't fail the invitation creation if email fails
  }

  return Response.json({
    token: einladung.token,
    url: inviteUrl,
  });
}

// GET /api/profile/[id]/invite — List invitations for a profile
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify ownership
  const profil = await prisma.hoererProfil.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!profil) {
    return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const einladungen = await prisma.profilEinladung.findMany({
    where: { hoererProfilId: id },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(einladungen);
}
