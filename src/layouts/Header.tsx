import { List, ListItem, Sheet } from "@mui/joy";
import BasicBreadcrumbs from "./BasicBreadCrumbs";
import { useManifest } from "../hooks/useManifest";
import Authentication from "./Authentication";

/**
 * Header is the header of the application. It contains the SDL logo and the breadcrumbs.
 * @returns A JSX element that represents the RootLayout component
 */

const Header = () => {
  const { data: manifest } = useManifest();

  return (
    <>
      <Sheet
        color="primary"
        variant="solid"
        sx={{
          top: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          position: "fixed",
          height: "2.7rem",
          zIndex: 10000,
          px: 2,
        }}
      >
        <List
          sx={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "flex-start",
            gap: 2,
          }}
        >
          <ListItem>
            <img alt="SDLB UI logo" src="images/sdl_logo_old_plain_white.svg" height={20} />
          </ListItem>
          <ListItem sx={{ flexGrow: 1 }}>
            <BasicBreadcrumbs />
          </ListItem>
        </List>
        {manifest?.auth && <Authentication />}
      </Sheet>
    </>
  );
};

export default Header;
