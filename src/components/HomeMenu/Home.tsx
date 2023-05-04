import PageHeader from "../../layouts/PageHeader";
import DemoGrid from "./DemoGrid";

const Home = () => {
    return ( 
        <>
            <PageHeader 
                title="Welcome to SDLB UI"
                description="Start by selecting a menu item from the left."
                noBack={true}
            />
        </>
     );
}
 
export default Home;