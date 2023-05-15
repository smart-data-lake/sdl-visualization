import { XAxis, YAxis, Tooltip, ResponsiveContainer, Line, LineChart, ReferenceArea } from 'recharts';
import { formatDuration } from '../../../util/WorkflowsExplorer/format';
import { CustomTooltip } from './ChartControl';
import { Indices } from '../Workflow/WorkflowHistory';


const HistoryLineChart = (props: {data : {value: number, status: string, name: string, runId: number, attemptId: number}[], indices: Indices}) => {
    const { data, indices } = props;

    console.log(indices )

    return (
            <ResponsiveContainer height={140}>
              <LineChart
                data={data}
              >
                <YAxis width={100} tickFormatter={(value) => formatDuration(value)}/>
                <XAxis dataKey="name" tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'})} minTickGap={10} ticks={[data[0]?.name, data[Math.round(data.length/2)]?.name, data[data.length-1]?.name]}/>
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
                <ReferenceArea x1={indices.rangeLeft} x2={indices.rangeRight}  stroke="blue" strokeOpacity={0.2} />
              </LineChart>
            </ResponsiveContainer>
      );
    }
 
export default HistoryLineChart;