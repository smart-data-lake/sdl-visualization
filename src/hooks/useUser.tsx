import React, { useMemo } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useFetchUsers } from "./useFetchData";

type UserContextType = {
  user_id?: string;
  email?: string;
  permissions: string[];
  authenticated: boolean;
  loginElement?: React.ReactElement;
  signOut?: () => void;
};

const UserContext = React.createContext<UserContextType | undefined>(undefined);
UserContext.displayName = "UserContext";
const emptyUserContext: UserContextType = { user_id: undefined, email: undefined, permissions: [], authenticated: false };

const UserProvider = (props: React.PropsWithChildren) => {
  // Which identity provider is behind this is decided in AuthProvider; here it is
  // only ever a session with a status, an identity and a way to sign out.
  const { status, userId, email, loginElement, signOut } = useAuth();
  const authenticated = status === "authenticated";
  const { data } = useFetchUsers(authenticated);

  // Derived, not stored: the session already is state, and copying it into another
  // useState through an effect would re-render on every identity change of
  // loginElement or signOut - which for some providers is every render.
  const userContext = useMemo<UserContextType>(() => {
    if (!authenticated) return { ...emptyUserContext, loginElement };
    const permissions = Array.isArray(data)
      ? data?.find((user) => user["user_id"] === userId)?.permissions ?? []
      : [];
    return { user_id: userId, email, permissions, authenticated: true, signOut };
  }, [userId, email, authenticated, loginElement, signOut, data]);

  return <UserContext.Provider value={userContext}>{props.children}</UserContext.Provider>;
};

const useUser = (): UserContextType | undefined => {
  return React.useContext(UserContext);
};

export { UserProvider, useUser };
