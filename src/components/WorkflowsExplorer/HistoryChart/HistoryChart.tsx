import Chart from "react-apexcharts";
import { formatDuration } from "../../../util/WorkflowsExplorer/format";

const HistoryChart = (props: {data : {succeeded: {x: string, y: number}[], cancelled: {x: string, y: number}[], categories: any[]}}) => {
    const { data } = props;
    const state1 ={
        options: {
            chart: {
                stacked: true,
                id: "main-chart",
                toolbar: {
                    show: false
                }
            },
            lengend: {
                show: false,
                position: 'top',
            },
            plotOptions: {
                bar: {
                    columnWidth: '80%',
                }
            },
            colors: ['#20af2e', '#eb3428'],
            dataLabels: {
                enabled: false
            },
            grid: {
                xaxis: {
                    lines: {
                        show: false
                    },
                },
                yaxis: {
                    lines: {
                        show: false
                    },
                }

            },
            xaxis: {
                labels: {
                    show: false
                },
                categories: data.categories,
            },
            yaxis: {
                labels: {
                    show: true,
                    formatter: (value: number) => {
                        return formatDuration(value);
                    }
                }
            }
        },
        series: [
            {
                name: "Succeeded",
                data: data.succeeded,

            },
            {
                name: "Cancelled",
                data: data.cancelled
            }
        ]
    }
    const state2 ={
        options: {
            chart: {
                stacked: true,
                id: "brush",
                animations: {
                    animateGradually: {
                        enabled: false
                    }
                },
                brush: {
                    enabled: true,
                    target: 'main-chart',
                  },
                  selection: {
                    enabled: true,
                    fill: {
                      color: '#ccc',
                      opacity: 0.4
                    },
                    stroke: {
                      color: '#0D47A1',
                    }
                  },
            },
            plotOptions: {
                bar: {
                    columnWidth: '50%',
                }
            },
            dataLabels: {
                enabled: false
            },
            colors: ['#20af2e', '#eb3428'],
            grid: {
                xaxis: {
                    lines: {
                        show: false
                    },
                },
                yaxis: {
                    lines: {
                        show: false
                    },
                }

            },
            xaxis: {
                labels: {
                    show: false
                }
            },
            yaxis: {
                labels: {
                    show: false,
                }
            }
        },
        series: [
            {
                name: "Succeeded",
                data: data.succeeded,

            },
            {
                name: "Cancelled",
                data: data.cancelled
            }
        ]
    }

    
    
    
    return ( 
        <>
            <Chart options={state1.options} series={state1.series} type="bar" width="100%" height={250} /> 
            {/* <Chart options={state2.options} series={state2.series} type="bar" width="100%" height={100} /> */}
        </>
        );
    }
 
export default HistoryChart;