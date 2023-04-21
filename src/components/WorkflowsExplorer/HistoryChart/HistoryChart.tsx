import React, { PureComponent, useState } from 'react';
import { formatDuration } from "../../../util/WorkflowsExplorer/format";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush, ReferenceLine } from 'recharts';
import { useLocation, useNavigate } from 'react-router-dom';

const HistoryChart = (props: {data : {value: number, status: string, name: string, runId: number, attemptId: number}[]}) => {
    const { data } = props;
	const curr = useLocation();
	const navigate = useNavigate();

    const handleClick = (data, index) => {
        const target = `${curr.pathname}/${data.runId}/${data.attemptId}/timeline`
		navigate(target);
    };

    return (
        <ResponsiveContainer width={"99%"} height={150}>
          <BarChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 20,
            }}
          >
            <Tooltip 
                cursor={{fill: 'black', fillOpacity: 0.1}}
                position={{ y: 0 }}
                animationDuration={0}
                label={false}
                labelFormatter={(value: string) => {
						if (data.length > parseInt(value)) return `Run ${data[value].runId} attempt ${data[value].attemptId}`
                  	}
                }
                formatter={(value: number, name: string) => {return [formatDuration(value) as any, 'Duration']}}
                />
            <YAxis tickFormatter={(value) => formatDuration(value)}/>
            <Bar 
                dataKey="value" 
                stackId="a" 
                fill="#20af2e"
                animationDuration={0}
                onClick={handleClick}
				onMouseOver={(data, index) => {console.log('*')}}
            >
                    {
                      data.map((entry, index) => {
                        return (
                          <Cell key={`cell-${index}`} fill={entry.status === 'SUCCEEDED' ? '#20af2e':'#eb3428'} />
                          )
                          {/* <Cell cursor="pointer" fill={index === activeIndex ? '#82ca9d' : '#8884d8'} key={`cell-${index}`} /> */}
                            }
                        )
                    }    
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }
 
export default HistoryChart;