import React, { PureComponent, useEffect, useState } from 'react';
import { formatDuration } from "../../../util/WorkflowsExplorer/format";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush, ReferenceLine } from 'recharts';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sheet, Typography } from '@mui/joy';
import { getIcon } from '../Workflow/RunsRow';
import { CustomTooltip } from './ChartControl';

const HistoryBarChart = (props: {data : {value: number, status: string, name: string, runId: number, attemptId: number}[]}) => {
    const { data } = props;
	  const [width, setWidth] = useState(data.length * 30);
    const curr = useLocation();
	  const navigate = useNavigate();

    useEffect(() => {
      if (data.length < 5) {
        setWidth(100);
      } else {
        setWidth(data.length * 30);
      }
    }, [data]);

    const handleClick = (data, index) => {
        const target = `${curr.pathname}/${data.runId}/${data.attemptId}/timeline`
		navigate(target);
    };

    return (
     

        <ResponsiveContainer height={140}>
          <BarChart data={data}>
            <Tooltip 
                /* cursor={{fill: 'lightgray', fillOpacity: 0.5, alignmentBaseline: 'middle'}}*/
                position={{ y: -75 }}
                animationDuration={100}
                /*label={false}
                labelFormatter={(value: string) => {
                  if (data.length > parseInt(value)) return `Run ${data[value].runId} attempt ${data[value].attemptId}`
                }
              } */
              content={<CustomTooltip active={undefined} payload={undefined} label={undefined}/>}
              //formatter={(value: number, name: string) => {return [formatDuration(value) as any, 'Duration']}}
              />
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
                          <Cell key={`cell-${index}`} fill={entry.status === 'SUCCEEDED' ? '#20af2e':'#eb3428'} />
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