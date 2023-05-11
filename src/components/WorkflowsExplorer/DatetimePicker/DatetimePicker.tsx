import React from 'react';
import { DatePicker, Space } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { Sheet } from '@mui/joy';


const DatetimePicker = () => {
		const { RangePicker } = DatePicker;
		
		const onChange = (date: Dayjs) => {
			if (date) {
				console.log('Date: ', date);
			} else {
				console.log('Clear');
			}
		};
		const onRangeChange = (dates: null | (Dayjs | null)[], dateStrings: string[]) => {
			if (dates) {
				console.log('From: ', dates[0], ', to: ', dates[1]);
				console.log('From: ', dateStrings[0], ', to: ', dateStrings[1]);
			} else {
				console.log('Clear');
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