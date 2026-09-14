import type { AuthRuntime } from "@/contracts/auth-runtime";
import http from "./api/http";
import { emitAuthorizationChanged } from "./composables/authorizationEvents";
import { useUserStore } from "./store/user";

export const authRuntime: AuthRuntime = {
  http,
  useAuthContext: useUserStore,
  emitAuthorizationChanged,
};
