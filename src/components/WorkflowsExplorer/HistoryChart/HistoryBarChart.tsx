import { formatDuration } from "../../../util/WorkflowsExplorer/format";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Brush } from 'recharts';
import { useLocation, useNavigate } from 'react-router-dom';
import { CustomTooltip } from './ChartControl';
import { scaleLog } from 'd3-scale';
import { getStatusColor } from "../../../util/WorkflowsExplorer/StatusInfo";
import { useTheme } from "@mui/joy/styles";
import { colorNameToCss } from "../../../util/helpers";

const HistoryBarChart = (props: {runs: any[]}) => {
    const { runs } = props;
    const curr = useLocation();
	  const navigate = useNavigate();
    const theme = useTheme();
    console.log(theme);

    const handleClick = (data, index) => {
        const target = `${curr.pathname}/${data.runId}/${data.attemptId}/timeline`
		navigate(target);
    };

    const scale = scaleLog().base(Math.E);

    return (
        <ResponsiveContainer height={140}>
          <BarChart data={runs.sort()}>
            <Tooltip 
                position={{ y: -75 }}
                animationDuration={100}
                content={<CustomTooltip active={undefined} payload={undefined} label={undefined}/>}
              />
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <YAxis width={77} tickFormatter={(value) => formatDuration(value)} scale="linear"/>
            <XAxis dataKey="attemptStartTime" tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'})} padding={'gap'} minTickGap={30}/>
            <Bar 
                dataKey="duration" 
                stackId="a" 
                fill="#20af2e"
                animationDuration={45}
                onClick={handleClick}
                barSize={runs.length < 26 ? 15 : undefined}
                radius={[2, 2, 0, 0]}
                >
                    {
                      runs.map((entry, index) => {
                        return (
                          <Cell key={`cell-${index}`} fill={colorNameToCss(getStatusColor(entry.status), theme)} style={{cursor: 'pointer'}} />
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