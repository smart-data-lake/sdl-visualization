import { Box, Sheet } from "@mui/joy";
import { useUser } from "../hooks/useUser";
import Authentication from "./Authentication";
import BasicBreadcrumbs from "./BasicBreadCrumbs";
import GlobalSearchButton from "../components/Search/GlobalSearchButton";

/**
 * Header is the header of the application. It contains the SDL logo, the breadcrumbs and
 * the global search. The breadcrumbs have flexGrow and truncate, so the search keeps its
 * width and a narrow window shrinks the breadcrumbs rather than the search box.
 * @returns A JSX element that represents the RootLayout component
 */

const Header = () => {
  const userContext = useUser();

  return (
    <>
      <Sheet color="primary" variant="solid"
        sx={{ top: 0, width: "100%", maxWidth: '100%', display: "flex", flexDirection: "row", alignItems: "flex-end", position: "fixed", height: 45, maxHeight: 45, zIndex: 10000,  paddingLeft: 2, paddingRight: "8.5px", gap: 2, paddingBottom: "7px" }}>
        <Box><img alt="SDLB UI logo" src="images/sdl_logo_old_plain_white.svg" height={20} /></Box>
        {(!userContext || userContext?.authenticated) && <BasicBreadcrumbs />}
        {(!userContext || userContext?.authenticated) && <GlobalSearchButton />}
        {userContext?.authenticated && <Authentication />}
      </Sheet>
    </>
  );
};

export default Header;
