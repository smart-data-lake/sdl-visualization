import * as React from 'react';
import AspectRatio from '@mui/joy/AspectRatio';
import Card from '@mui/joy/Card';
import CardContent from '@mui/joy/CardContent';
import CardOverflow from '@mui/joy/CardOverflow';
import Typography from '@mui/joy/Typography';
import { Box, Button, Link } from '@mui/joy';
import { useNavigate } from 'react-router-dom';

export default function OverflowCard(props: {title: string, subtitle: string, image?: string, link?: string} ) {
  const { title, subtitle, image, link } = props;
  const navigate = useNavigate();

  const handleClick = () => {
    console.log(link)
    if(link?.split(';')[0] === 'internal') {
      navigate(link?.split(';')[1]);
    }
    else if(link?.split(';')[0] === 'external') {
      window.open(link?.split(';')[1], '_blank');
    }
  }

  return (
    <Card 
      variant="outlined" 
      sx={{ 
        bgcolor: 'background.body','&:hover, &:focus-within': {bgcolor: 'background.level2',}, 
      }}>
      <CardOverflow>
        <AspectRatio ratio="2">
          <img src={image ? image : 'none'} alt="SDLB UI" />
        </AspectRatio>
      </CardOverflow>
      <CardContent sx={{ mt: 1}}>

          <Typography level="h2" fontSize="md" >
            {title}
          </Typography>
          <Typography level="body2" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        <Link overlay onClick={handleClick} />
      </CardContent>
      
    </Card>
  );
}