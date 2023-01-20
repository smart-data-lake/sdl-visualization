import { IconButton } from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import { toPng } from 'html-to-image';

function downloadImage(dataUrl: string) {
  const a = document.createElement('a');
  a.setAttribute('download', 'lineage.png');
  a.setAttribute('href', dataUrl);
  a.click();
}

function DownloadButton() {
  const download = () => {
    toPng(document.querySelector('.react-flow') as HTMLElement, {
      filter: (node) => {
        console.log(node.classList)
        // don't include minimap, the controls and the MUI Buttons.
        if (
          node?.classList?.contains('react-flow__minimap') ||
          node?.classList?.contains('react-flow__controls') ||
          node?.classList?.contains('MuiSvgIcon-root') ||
          node?.classList?.contains('MuiButtonBase-root')
        ) {
          return false;
        }

        return true;
      },
    }).then(downloadImage);
  };

  return (


    <IconButton
      color='primary'
      onClick={download}>
      <CloudDownloadIcon />
    </IconButton>


  );
}

export default DownloadButton;