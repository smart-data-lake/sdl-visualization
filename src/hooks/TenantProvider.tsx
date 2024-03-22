import React, { useState } from "react";

type TenantContextType = {
  tenant: string;
  setTenant: React.Dispatch<React.SetStateAction<string>>;
};

const TenantContext = React.createContext<TenantContextType | undefined>(
  undefined
);
TenantContext.displayName = "TenantContext";

const TenantProvider = (props: React.PropsWithChildren) => {
  const [tenant, setTenant] = useState<string>("PrivateTenant");

  return (
    <TenantContext.Provider value={{ tenant, setTenant }}>
      {props.children}
    </TenantContext.Provider>
  );
};

const useTenant = (): TenantContextType => {
  const context = React.useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantContext");
  }
  return context;
};

export { TenantProvider, useTenant };
