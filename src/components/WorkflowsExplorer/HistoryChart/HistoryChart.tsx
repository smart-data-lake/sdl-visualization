import React, { PureComponent } from 'react';
import { formatDuration } from "../../../util/WorkflowsExplorer/format";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush, ReferenceLine } from 'recharts';

const HistoryChart = (props: {data : {value: number, status: string, name: string}[]}) => {
    const { data } = props;
    const barColors = ["#1f77b4", "#ff7f0e", "#2ca02c"]
    return (
        <ResponsiveContainer width={"99%"} height={240}>
          <BarChart
            width={500}
            height={300}
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <Tooltip 
                cursor={{fill: 'black', fillOpacity: 0.1}}
                position={{ y: 0 }}
                animationDuration={0}
                labelFormatter={(label: string) => {return 'Date: ' + data[parseInt(label)].name}}
                formatter={(value: number, name: string) => {return [formatDuration(value) as any, 'Duration']}}
            />
            <Bar 
                dataKey="value" 
                stackId="a" 
                fill="#20af2e"
                animationDuration={0}
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
            <Brush height={30} stroke="#d1d1d1" />
          </BarChart>
        </ResponsiveContainer>
      );
    }
 
export default HistoryChart;