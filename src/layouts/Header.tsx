import { Box, List, ListItem, Sheet } from "@mui/joy";
import BasicBreadcrumbs from "./BasicBreadCrumbs";
import { useManifest } from "../hooks/useManifest";
import Authentication from "./Authentication";
import { useUser } from "../hooks/useUser";

/**
 * Header is the header of the application. It contains the SDL logo and the breadcrumbs.
 * @returns A JSX element that represents the RootLayout component
 */

const Header = () => {
  const userContext = useUser();

  return (
    <>
      <Sheet color="primary" variant="solid"
        sx={{ top: 0, width: "100%", display: "flex", flexDirection: "row", alignItems: "flex-end", position: "fixed", height: 45, zIndex: 10000,  paddingX: 2, gap: 2, paddingBottom: "7px" }}>
        <Box><img alt="SDLB UI logo" src="images/sdl_logo_old_plain_white.svg" height={20} /></Box>
        {userContext?.authenticated && <BasicBreadcrumbs />}
        <Box sx={{ flexGrow: 1 }} />
        {userContext?.authenticated && <Authentication />}
      </Sheet>
    </>
  );
};

export default Header;
