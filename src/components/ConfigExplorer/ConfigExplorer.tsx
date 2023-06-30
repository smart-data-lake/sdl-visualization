import './App.css';
import ElementList from './ElementList';
import { Outlet } from "react-router-dom";
import { Sheet } from '@mui/joy';
import PageHeader from '../../layouts/PageHeader';



function ConfigExplorer(props: {data: any}) {
  const { data } = props;

  return (
    <>
    	<PageHeader title={'Configuration'} noBack={true} />
    	<Sheet
			sx={{
				display: 'flex',
				height: '86vh',
			}}
			>
    	  	<ElementList data={data} />
    	  	<Outlet />
    	</Sheet>
    </>
  );
}

export default ConfigExplorer;
