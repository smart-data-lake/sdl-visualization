import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, Line, LineChart, ReferenceArea, Brush } from 'recharts';
import { formatDuration } from '../../../util/WorkflowsExplorer/format';
import { scaleLog } from 'd3-scale';
import { Indices } from '../Workflow/WorkflowHistory';
import { CustomTooltip } from './ChartControl';
import { Typography } from '@mui/joy';
import { useState } from 'react';



const HistoryLineChart = (props: {data : {value: number, status: string, name: string, runId: number, attemptId: number}[]}) => {
    const { data } = props;

    return (
            <ResponsiveContainer height={140}>
              <LineChart
                data={data}
              >
                <YAxis width={100} tickFormatter={(value) => formatDuration(value)}/>
                <XAxis dataKey="name" tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'})} padding={'gap'} minTickGap={10} ticks={[data[0]?.name, data[Math.round(data.length/2)]?.name, data[data.length-1]?.name]}/>
                <Tooltip
                  animationDuration={45}
                  position={{y: -75 }}
                  content={<CustomTooltip active={undefined} payload={undefined} label={undefined} />}
                />
                <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#096bde" 
                    fill= "#096bde"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                    />
              </LineChart>
            </ResponsiveContainer>
      );
    }
 
export default HistoryLineChart;