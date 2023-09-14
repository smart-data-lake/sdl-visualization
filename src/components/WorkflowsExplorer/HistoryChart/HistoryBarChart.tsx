import { useTheme } from "@mui/joy/styles";
import { useState } from "react";
import { useLocation, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDuration } from "../../../util/WorkflowsExplorer/format";
import { CustomTooltip } from "./CustomTooltip";
import { getStatusColor } from "../Timeline/TimelineRow/utils";

const HistoryBarChart = (props: {runs: any[], selectRange: (range: [Date,Date]) => void}) => {
    const { runs } = props;
    const curr = useLocation();
	  const navigate = useNavigate();
    const [refArea, setRefArea] = useState<number[]>([]);
    const theme = useTheme();

    const handleClick = (data, index) => {
      const target = `${curr.pathname}/${data.runId}/${data.attemptId}/timeline`
		  navigate(target);
    };

    const handleSelectRange = (endDate) => {
      if (refArea.length > 0) {
        if (refArea[0] && endDate) props.selectRange([new Date(Math.min(refArea[0], endDate)), new Date(Math.max(refArea[0], endDate))]);
        setRefArea([]); // reset
      }
    }


    //TODO: ticks on y axis are not yet optimal
    // logarithmic scale, or tune maxY?
    //const scale = scaleLog().base(Math.E);
    const maxY = runs.map(run => run.duration as number).reduce((max, cur) => Math.max(max,cur));
    const maxYFloorMinute = Math.max(Math.floor(maxY/1000/60)*1000*60, 1000*60); // value for main tick on y axis, minimum is 1 minute
    const maxYCeilMinute = maxYFloorMinute + 1000*60; // add an additional minute for the domain max y value

    return (
      <ResponsiveContainer height={140} debounce={10}>
        <BarChart data={runs}
                  onMouseDown={(e: any) => setRefArea((e && e.activeLabel) ? [e.activeLabel as number] : [])}
                  onMouseMove={(e: any) => refArea.length > 0 && setRefArea((e && e.activeLabel) ? [refArea[0], e.activeLabel as number] : [])}
                  onMouseUp={(e: any) => (e && e.activeLabel) ? handleSelectRange(e.activeLabel as number) : setRefArea([])}
                  onMouseLeave={(e: any) => setRefArea([])}
                  >
            <Tooltip 
                position={{ y: -100 }}
                animationDuration={500}
                content={<CustomTooltip active={undefined} payload={undefined} label={undefined}/>}
              />
            <CartesianGrid vertical={false} strokeDasharray="3" />
            <YAxis width={77} ticks={[0, maxYFloorMinute]} domain={[0, maxYCeilMinute]} tickFormatter={(value) => formatDuration(value)} scale="linear"/>
            <XAxis dataKey="attemptStartTimeMillis" tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'})} padding={'gap'} minTickGap={30}/>
            <Bar 
                dataKey="duration" 
                stackId="a" 
                fill="#20af2e"
                onClick={handleClick}
                barSize={runs.length < 26 ? 15 : undefined}
                radius={[2, 2, 0, 0]}
                minPointSize={5}
                isAnimationActive={false}
                >
                  {runs.map((entry, index) => <Cell key={`cell-${index}`} fill={getStatusColor(entry.status)} style={{cursor: 'pointer'}} />)}    
            </Bar>
            {refArea && refArea.length == 2 && <ReferenceArea yAxisId="0" ifOverflow="hidden" x1={refArea[0]} x2={refArea[1]} strokeOpacity={0.3}/>}            
          </BarChart>
        </ResponsiveContainer>
    )}
 
export default HistoryBarChart;