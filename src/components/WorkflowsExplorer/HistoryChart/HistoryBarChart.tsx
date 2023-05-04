import React, { PureComponent, useState } from 'react';
import { formatDuration } from "../../../util/WorkflowsExplorer/format";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush, ReferenceLine } from 'recharts';
import { useLocation, useNavigate } from 'react-router-dom';

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
          <BarChart
            data={data}
            >
            <Tooltip 
                cursor={{fill: 'lightgray', fillOpacity: 0.2, alignmentBaseline: 'middle'}}
                position={{ y: 0 }}
                animationDuration={0}
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
                radius={[5, 5, 1, 1]}
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