import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

const HistoryPieChart = (props: {data : {value: number, status: string, name: string, runId: number, attemptId: number}[]}) => {
    const { data } = props;

    const COLORS = ['#20af2e', '#eb3428'];

    const processData = () => {
        const result = [
            {name: 'Succeeded', value: 0},
            {name: 'Cancelled', value: 0},
        ];

        for (let i = 0; i < data.length; i++) {
            if (data[i].status === 'SUCCEEDED') {
                result[0].value += 1;
            } else if (data[i].status === 'CANCELLED') {
                result[1].value += 1;
            }
        }
        return result;
    }

    const toDisplay = processData();

    return (
        <ResponsiveContainer width="99%" height="99%">
          <PieChart >
            <Pie data={toDisplay} dataKey="value" cx="50%" cy="50%" innerRadius={44} outerRadius={54} fill="#82ca9d" label >
            {toDisplay.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.name === 'Succeeded' ? COLORS[0] : COLORS[1]} />
            ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );
    }
 
export default HistoryPieChart;
