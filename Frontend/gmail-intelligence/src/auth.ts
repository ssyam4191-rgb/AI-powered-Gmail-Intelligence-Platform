import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { createAdminClient } from "@/lib/supabase/server"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.labels",
            "https://www.googleapis.com/auth/gmail.modify",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Persist OAuth tokens in JWT on initial sign-in
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
        token.googleId = profile?.sub
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      session.refreshToken = token.refreshToken as string
      session.expiresAt = token.expiresAt as number
      session.googleId = token.googleId as string

      // Upsert user into Supabase users table
      if (session.user?.email) {
        const supabase = createAdminClient()
        const { data: existingUser } = await supabase
          .from("users")
          .select("id")
          .eq("email", session.user.email)
          .single()

        if (!existingUser) {
          await supabase.from("users").insert({
            email: session.user.email,
            gmail_access_token: session.accessToken,
            gmail_refresh_token: session.refreshToken,
            token_expiry: session.expiresAt
              ? new Date(session.expiresAt * 1000).toISOString()
              : null,
          })
        } else {
          await supabase
            .from("users")
            .update({
              gmail_access_token: session.accessToken,
              gmail_refresh_token: session.refreshToken,
              token_expiry: session.expiresAt
                ? new Date(session.expiresAt * 1000).toISOString()
                : null,
            })
            .eq("id", existingUser.id)
          session.userId = existingUser.id
        }

        if (!session.userId) {
          const { data: newUser } = await supabase
            .from("users")
            .select("id")
            .eq("email", session.user.email)
            .single()
          session.userId = newUser?.id
        }
      }

      return session
    },
  },
  pages: {
    signIn: "/login",
  },
})

// Extend next-auth types
declare module "next-auth" {
  interface Session {
    accessToken: string
    refreshToken: string
    expiresAt: number
    googleId: string
    userId: string
  }
}
