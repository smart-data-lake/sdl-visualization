import { useAuthenticator } from "@aws-amplify/ui-react";
import React, { useEffect, useState } from "react";
import { useFetchUsers } from "./useFetchData";
import { Authenticator} from '@aws-amplify/ui-react';
import { SignpostOutlined } from "@mui/icons-material";

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
const emptyUserContext = { user_id: undefined, email: undefined, permissions: [], authenticated: false, loginElement: <Authenticator variation="modal" /> };

const UserProvider = (props: React.PropsWithChildren) => {
  const { user, signOut, authStatus } = useAuthenticator();
  const { data } = useFetchUsers(authStatus === "authenticated");
  const [userContext, setUserContext] = useState<UserContextType | undefined>(emptyUserContext);
  
  useEffect(() => {
    if (authStatus === "authenticated") {
      const user_id = user?.attributes?.sub;
      const email = user?.attributes?.email;
      const permissions = Array.isArray(data)
        ? data?.find((user) => user["user_id"] === user_id)?.permissions ?? []
        : [];
      setUserContext({ user_id: user_id, email: email, permissions: permissions, authenticated: true, signOut: () => signOut() });
    } else {  
      setUserContext(emptyUserContext);
    }
  }, [user, authStatus, data]);

  return <UserContext.Provider value={userContext}>{props.children}</UserContext.Provider>;
};

const useUser = (): UserContextType | undefined => {
  return React.useContext(UserContext);
};

export { UserProvider, useUser };
