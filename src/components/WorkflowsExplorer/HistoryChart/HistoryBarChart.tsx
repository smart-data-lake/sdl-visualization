import { formatDuration } from "../../../util/WorkflowsExplorer/format";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useLocation, useNavigate } from 'react-router-dom';
import { CustomTooltip } from './ChartControl';

const HistoryBarChart = (props: {data : {value: number, status: string, name: string, runId: number, attemptId: number}[]}) => {
    const { data } = props;
    const curr = useLocation();
	  const navigate = useNavigate();

    const handleClick = (data, index) => {
        const target = `${curr.pathname}/${data.runId}/${data.attemptId}/timeline`
		navigate(target);
    };

    return (
     

        <ResponsiveContainer height={140}>
          <BarChart data={data}>
            <Tooltip 
                position={{ y: -75 }}
                animationDuration={100}
                content={<CustomTooltip active={undefined} payload={undefined} label={undefined}/>}
              />
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <YAxis width={77} tickFormatter={(value) => formatDuration(value)}/>
            <XAxis dataKey="name" tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'})} padding={'gap'} minTickGap={30}/>
            <Bar 
                dataKey="value" 
                stackId="a" 
                fill="#20af2e"
                animationDuration={45}
                onClick={handleClick}
                barSize={data.length < 26 ? 15 : undefined}
                radius={[2, 2, 0, 0]}
                >
                    {
                      data.map((entry, index) => {
                        return (
                          <Cell key={`cell-${index}`} fill={entry.status === 'SUCCEEDED' ? '#20af2e':'#eb3428'} style={{cursor: 'pointer'}} />
                          )
                        }
                        )
                      }    
            </Bar>
          </BarChart>
        </ResponsiveContainer>
    );
    }
 
export default HistoryBarChart;