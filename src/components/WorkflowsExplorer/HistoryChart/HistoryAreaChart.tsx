import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, Line, LineChart } from 'recharts';
import { formatDuration } from '../../../util/WorkflowsExplorer/format';

const HistoryAreaChart = (props: {data : {value: number, status: string, name: string, runId: number, attemptId: number}[]}) => {
    const { data } = props;

    return (
            <ResponsiveContainer width="99%" height="100%">
              <LineChart
                width={500}
                height={400}
                data={data}
                >
                {/* <YAxis tickFormatter={(value) => formatDuration(value)}/> */}
                {/* <Tooltip /> */}
                <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#065bbf" 
                    fill="#096bde" 
                    animationDuration={200}
                />
              </LineChart>
            </ResponsiveContainer>
      );
    }
 
export default HistoryAreaChart;