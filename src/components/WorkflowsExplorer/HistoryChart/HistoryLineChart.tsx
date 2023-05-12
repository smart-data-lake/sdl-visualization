import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, Line, LineChart, ReferenceArea, Brush } from 'recharts';
import { formatDuration } from '../../../util/WorkflowsExplorer/format';
import { scaleLog } from 'd3-scale';
import { Indices } from '../Workflow/WorkflowHistory';
import { CustomTooltip } from './ChartControl';

const HistoryLineChart = (props: {data : {value: number, status: string, name: string, runId: number, attemptId: number}[], indices: Indices}) => {
    const { data, indices } = props;

    return (
            <ResponsiveContainer height={140}>
              <LineChart
                data={data}
                >
                <YAxis tickFormatter={(value) => formatDuration(value)}/>
                <Tooltip
                  animationDuration={100}
                  position={{ y: 10 }}
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
                {/* <ReferenceArea x1={indices.toDisplayLeft} x2={indices?.toDisplayRight} stroke="blue" strokeOpacity={0.5} />
                <ReferenceArea x1={indices.rangeLeft} x2={indices?.rangeRight}/> */}
              </LineChart>
            </ResponsiveContainer>
      );
    }
 
export default HistoryLineChart;