import { DatePicker, Space } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { Sheet } from '@mui/joy';


const DatetimePicker = (props : {datetimePicker: (start: Date, end: Date) => void}) => {
		const { RangePicker } = DatePicker;
		
		const onRangeChange = (dates: null | (Dayjs | null)[], dateStrings: string[]) => {
			
			if (!dates) return props.datetimePicker(new Date(0), new Date());
			
			if (dates[0] && dates[1]) {
				props.datetimePicker(dates[0].toDate(), dates[1].toDate());
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
				<Sheet
						sx={{
								display: 'flex',
								justifyContent: 'flex-end',
								zIndex: 1,
						}}
				>
							<RangePicker
								presets={rangePresets}
								showTime
								format="YYYY/MM/DD HH:mm:ss"
								onChange={onRangeChange}
							/>
				</Sheet>
				
		);
};

export default DatetimePicker;