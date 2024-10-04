import { useAuthenticator } from "@aws-amplify/ui-react";
import React, { useEffect, useState } from "react";
import { useFetchUsers } from "./useFetchData";

type UserContextType = {
  user_id?: string;
  email?: string;
  permissions: string[];
  authenticated: boolean;
};

const UserContext = React.createContext<UserContextType | undefined>(undefined);
UserContext.displayName = "UserContext";

const UserProvider = (props: React.PropsWithChildren) => {
  const { user, authStatus } = useAuthenticator();
  const { data } = useFetchUsers(authStatus === "authenticated");
  const [userContext, setUserContext] = useState<UserContextType | undefined>({ user_id: undefined, email: undefined, permissions: [], authenticated: false });

  useEffect(() => {
    if (authStatus === "authenticated") {
      const user_id = user?.attributes?.sub;
      const email = user?.attributes?.email;
      const permissions = Array.isArray(data)
        ? data?.find((user) => user["user_id"] === user_id)?.permissions ?? []
        : [];
      setUserContext({ user_id: user_id, email: email, permissions: permissions, authenticated: true });
    } else {  
      setUserContext({ user_id: undefined, email: undefined, permissions: [], authenticated: false });
    }
  }, [user, authStatus, data]);

  return <UserContext.Provider value={userContext}>{props.children}</UserContext.Provider>;
};

const useUser = (): UserContextType | undefined => {
  return React.useContext(UserContext);
};

export { UserProvider, useUser };
