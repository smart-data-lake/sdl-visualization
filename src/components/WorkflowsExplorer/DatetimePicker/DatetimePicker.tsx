import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { Sheet } from '@mui/joy';


const DatetimePicker = (props : {range?: [Date,Date], setRange: (range?: [Date, Date]) => void}) => {
		const { RangePicker } = DatePicker;
		
		const onRangeChange = (dates: null | (Dayjs | null)[], dateStrings: string[]) => {			
			if (dates && dates[0] && dates[1]) {
				props.setRange([dates[0].toDate(), dates[1].toDate()]);
			} else {
				props.setRange(undefined);
			} 			
		};
		
		const rangePresets: {
			label: string;
			value: [Dayjs, Dayjs];
		}[] = [
			{ label: 'Last 7 Days', value: [dayjs().add(-7, 'd'), dayjs()] },
			{ label: 'Last 14 Days', value: [dayjs().add(-14, 'd'), dayjs()] },
			{ label: 'Last 30 Days', value: [dayjs().add(-30, 'd'), dayjs()] },
			{ label: 'Last 90 Days', value: [dayjs().add(-90, 'd'), dayjs()] },
		];
				
		return (
				<Sheet sx={{ width: '27%'}}>
							<RangePicker
								value={(props.range ? [dayjs(props.range[0]), dayjs(props.range[1])] : null)}
								presets={rangePresets}
								showTime
								format="YYYY/MM/DD HH:mm:ss"
								onChange={onRangeChange}
							/>
				</Sheet>
				
		);
};

export default DatetimePicker;