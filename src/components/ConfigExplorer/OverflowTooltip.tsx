import { Tooltip } from "@mui/joy";
import { useState } from "react";
import { MouseEvent } from "react";

export const OverflowTooltip = (props: {text: string, maxWidth: string}) => {
  const [tooltipEnabled, setTooltipEnabled] = useState(false);

  const handleShouldShow = ({ currentTarget }: MouseEvent<Element>) => {
    if (currentTarget.scrollWidth > currentTarget.clientWidth) {
      setTooltipEnabled(true);
    }
  };

  return (
    <Tooltip title={props.text} sx={{maxWidth: props.maxWidth}} arrow variant="soft" placement='bottom-start' open={tooltipEnabled}>
      <div className='ka-cell-text' onMouseEnter={handleShouldShow} onMouseLeave={() => setTooltipEnabled(false)}>{props.text}</div>
    </Tooltip>
  );
};