import { Theme } from "@emotion/react";
import { SxProps } from "@mui/material";

export const dataTableStyleProps: SxProps<Theme> = {
  fontFamily: "Roboto,Helvetica,Arial,sans-serif",
  fontWeight: "400",
  fontSize: "0.875rem", // defaults from MuiTypography-root
  "& ka-table-wrapper": { overflow: "auto" },
  "& .ka-thead-cell-content, .ka-cell-text": {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  "& .ka-row": { cursor: "pointer", "&:hover": { backgroundColor: "#f0f0ef" } },
  "& .ka-thead-background": { backgroundColor: "white" },
  "& .ka-thead-cell": {
    color: "primary",
    zIndex: "99",
    fontWeight: "600",
    height: "25px",
    paddingTop: "7px",
    paddingBottom: "7px",
  },
  "& .ka-cell, .ka-thead-cell": { paddingLeft: "7px", paddingRight: "7px" },
  "& .ka-cell": { paddingTop: "4px", paddingBottom: "4px" },
  "& .ka-cell-text": { height: "25px" },
  "& .ka-thead-cell-resize": { left: "3px" },
  "& .ka": { height: "100%", width: "100%" },
};
