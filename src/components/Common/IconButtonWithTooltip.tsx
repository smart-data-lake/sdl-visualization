import { IconButton, Tooltip } from "@mui/joy";
import { SvgIcon } from "@mui/material";

export interface IconButtonWithTooltipProps {
  icon: typeof SvgIcon;
  showTooltip: boolean;
  tooltipMessage: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  color?: "danger" | "neutral" | "primary" | "success" | "warning";
  onClick?: () => void;
}

export default function IconButtonWithTooltip({
  icon: Icon,
  showTooltip,
  tooltipMessage,
  disabled,
  size,
  color,
  onClick,
}: IconButtonWithTooltipProps) {
  return (
    <Tooltip title={showTooltip ? tooltipMessage : ""}>
      <span>
        <IconButton disabled={disabled} size={size} color={color} onClick={onClick}>
          <Icon />
        </IconButton>
      </span>
    </Tooltip>
  );
}
