export type AdlRole = "agent" | "admin" | "client";

type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  isAdmin?: boolean;
  role: AdlRole;
};

export type MockAuthSession = {
  user: SessionUser;
  expires: string;
};

export type BrowserSeedState = {
  localStorage: Record<string, string>;
  lowEndHints?: {
    deviceMemoryGb: number;
    hardwareConcurrency: number;
  };
};

const SESSION_EXPIRY = "2030-01-01T00:00:00.000Z";

const ROLE_SESSIONS: Record<AdlRole, MockAuthSession> = {
  agent: {
    user: {
      id: "agent.bonamoussadi@adl.test",
      name: "Chantal Field Ops",
      email: "agent.bonamoussadi@adl.test",
      image: "baobab",
      role: "agent",
      isAdmin: false,
    },
    expires: SESSION_EXPIRY,
  },
  admin: {
    user: {
      id: "admin.ops@adl.test",
      name: "Amina Review Lead",
      email: "admin.ops@adl.test",
      image: "baobab",
      role: "admin",
      isAdmin: true,
    },
    expires: SESSION_EXPIRY,
  },
  client: {
    user: {
      id: "client.insights@adl.test",
      name: "Kasi Insight Buyer",
      email: "client.insights@adl.test",
      image: "baobab",
      role: "client",
      isAdmin: false,
    },
    expires: SESSION_EXPIRY,
  },
};

export function roleFromProjectName(projectName: string): AdlRole {
  if (projectName.startsWith("admin")) return "admin";
  if (projectName.startsWith("client")) return "client";
  return "agent";
}

export function getMockSession(role: AdlRole): MockAuthSession {
  return ROLE_SESSIONS[role];
}

export function getBrowserSeedState(role: AdlRole): BrowserSeedState {
  return {
    localStorage: {
      adl_splash_seen: "true",
      adl_has_authenticated: "true",
      adl_language: "en",
      adl_e2e_role: role,
    },
    lowEndHints:
      role === "agent"
        ? {
            deviceMemoryGb: 2,
            hardwareConcurrency: 4,
          }
        : undefined,
  };
}
