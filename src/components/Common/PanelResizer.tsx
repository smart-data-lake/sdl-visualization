import { PanelResizeHandle } from 'react-resizable-panels'
import { Divider } from '@mui/joy'
import { DragIndicator } from '@mui/icons-material'
import { useState } from 'react'

export function PanelResizer(props: {style?: {}}) {
  const [isDrag, setDrag] = useState(false)

  return (
  <PanelResizeHandle style={{height: "100%", alignSelf: "center", ...props.style}} onDragging={drag => setDrag(drag)}>
    <Divider orientation='vertical' sx={{height: "100%",  backgroundColor: (isDrag ? "#F0F0F0" : "transparent")}}>
      <DragIndicator sx={{ fontSize: 15 }} />
    </Divider>
  </PanelResizeHandle>
  )
}