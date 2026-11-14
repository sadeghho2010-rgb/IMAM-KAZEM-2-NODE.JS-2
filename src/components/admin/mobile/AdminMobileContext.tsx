import React, { createContext, useContext } from 'react';

const AdminMobileContext = createContext<boolean>(false);

export const AdminMobileProvider: React.FC<{ value?: boolean; children: React.ReactNode }> = ({
  value = true,
  children,
}) => {
  return <AdminMobileContext.Provider value={value}>{children}</AdminMobileContext.Provider>;
};

export function useIsAdminMobile(): boolean {
  return useContext(AdminMobileContext);
}
