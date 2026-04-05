import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { Resend as ResendClient } from "resend";
import { prisma } from "@/lib/db";

const resend = new ResendClient(process.env.RESEND_API_KEY);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/sign-in?verify=1",
  },
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM || "KoalaTree <noreply@koalatree.ai>",
      generateVerificationToken() {
        // 6-stelliger Code statt langer Token-URL
        return String(Math.floor(100000 + Math.random() * 900000));
      },
      async sendVerificationRequest({ identifier: email, token, provider }) {
        await resend.emails.send({
          from: provider.from as string,
          to: email,
          subject: `Dein Login-Code: ${token}`,
          html: `
            <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #1a2e1a; margin-bottom: 8px;">KoalaTree Login</h2>
              <p style="color: #555; margin-bottom: 24px;">Gib diesen Code auf der Website ein:</p>
              <div style="background: #1a2e1a; color: #f5eed6; font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; border-radius: 12px;">
                ${token}
              </div>
              <p style="color: #999; font-size: 13px; margin-top: 24px;">
                Der Code ist 24 Stunden gültig. Falls du diese Email nicht angefordert hast, ignoriere sie einfach.
              </p>
            </div>
          `,
        });
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
