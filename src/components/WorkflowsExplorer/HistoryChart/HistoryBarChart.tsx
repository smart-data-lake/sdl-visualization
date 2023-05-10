import React, { PureComponent, useEffect, useState } from 'react';
import { formatDuration } from "../../../util/WorkflowsExplorer/format";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush, ReferenceLine } from 'recharts';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sheet } from '@mui/joy';

const HistoryBarChart = (props: {data : {value: number, status: string, name: string, runId: number, attemptId: number}[]}) => {
    const { data } = props;
	  const [width, setWidth] = useState(data.length * 45);
    const curr = useLocation();
	  const navigate = useNavigate();

    useEffect(() => {
      if (data.length < 5) {
        setWidth(100);
      } else {
        setWidth(data.length * 45);
      }
    }, [data]);

    const handleClick = (data, index) => {
        const target = `${curr.pathname}/${data.runId}/${data.attemptId}/timeline`
		navigate(target);
    };

    return (
      <Sheet
        sx={{
          flex: 1,
          width: '50vw',
          display: 'flex', 
          justifyContent: 'flex-end',
        }}
      >
        <Sheet
          sx={{
            overflowX: 'scroll',
            overflowY: 'hidden',
          }}
        >

        <ResponsiveContainer height={140} width={width}>
          <BarChart
            data={data}
            >
            <Tooltip 
                cursor={{fill: 'lightgray', fillOpacity: 0.5, alignmentBaseline: 'middle'}}
                position={{ y: 0 }}
                animationDuration={100}
                label={false}
                labelFormatter={(value: string) => {
                  if (data.length > parseInt(value)) return `Run ${data[value].runId} attempt ${data[value].attemptId}`
                }
              }
              formatter={(value: number, name: string) => {return [formatDuration(value) as any, 'Duration']}}
              />
            <YAxis width={77} tickFormatter={(value) => formatDuration(value)}/>
              
            <Bar 
                dataKey="value" 
                stackId="a" 
                fill="#20af2e"
                animationDuration={100}
                onClick={handleClick}
                barSize={15}
                radius={[3, 3, 1, 1]}
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
        </Sheet>
      </Sheet>
    );
    }
 
export default HistoryBarChart;