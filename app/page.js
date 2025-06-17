'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import { Box, Button, Container, Paper, Typography, CircularProgress, TextField, Tab, Tabs, Divider, List, ListItem, ListItemText } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PrintIcon from '@mui/icons-material/Print';
import DescriptionIcon from '@mui/icons-material/Description';
import LinkIcon from '@mui/icons-material/Link';

export default function Home() {
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [inputMethod, setInputMethod] = useState(0);
  const [report, setReport] = useState({
    view: '',
    sectionAnalysis: {},
    findings: '',
    impression: ''
  });

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result);
      setImageUrl('');
      setReport({ view: '', sectionAnalysis: {}, findings: '', impression: '' });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleUrlChange = (event) => {
    setImageUrl(event.target.value);
    setImage(null);
    setReport({ view: '', sectionAnalysis: {}, findings: '', impression: '' });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png']
    },
    multiple: false
  });

  const generateReport = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const imagePath = image || imageUrl;

      if (!imagePath) {
        throw new Error("No image selected. Please upload an image or provide a URL.");
      }

      // 1. Section-by-section analysis
      const sectionResponse = await fetch('http://localhost:8000/api/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task: 'section_by_section',
          paths: [imagePath]
        }),
      });

      if (!sectionResponse.ok) {
        const errorData = await sectionResponse.json();
        throw new Error(errorData.detail || 'Failed to generate section-by-section report');
      }

      const sectionData = await sectionResponse.json();
      const sectionAnalysis = sectionData.section_by_section || {};

      // 2. Summarization
      const combinedFindings = Object.entries(sectionAnalysis)
        .map(([anatomy, text]) => `${anatomy}: ${text}`)
        .join('\n');

      const summaryResponse = await fetch('http://localhost:8000/api/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task: 'summarize',
          findings: combinedFindings
        }),
      });

      if (!summaryResponse.ok) {
        const errorData = await summaryResponse.json();
        throw new Error(errorData.detail || 'Failed to generate summary');
      }

      const summaryData = await summaryResponse.json();
      const summary = summaryData.summary || '';

      setReport({
        view: '',
        sectionAnalysis,
        findings: combinedFindings,
        impression: summary
      });
    } catch (err) {
      setError(err.message);
      console.error('Error generating report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Radiology Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .section { margin-bottom: 20px; }
            .title { font-weight: bold; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <h1>Radiology Report</h1>
          ${report.view ? `<div class="section"><div class="title">View:</div>${report.view}</div>` : ''}
          ${Object.keys(report.sectionAnalysis).length > 0 ? `
            <div class="section">
              <div class="title">Section Analysis:</div>
              ${Object.entries(report.sectionAnalysis).map(([section, content]) => `
                <div><strong>${section}:</strong> ${content}</div>
              `).join('')}
            </div>
          ` : ''}
          ${report.findings ? `<div class="section"><div class="title">Findings:</div><pre>${report.findings}</pre></div>` : ''}
          ${report.impression ? `<div class="section"><div class="title">Impression:</div>${report.impression}</div>` : ''}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Tabs
          value={inputMethod}
          onChange={(e, newValue) => setInputMethod(newValue)}
          centered
          sx={{ mb: 2 }}
        >
          <Tab label="Upload Image" icon={<CloudUploadIcon />} />
          <Tab label="Image URL" icon={<LinkIcon />} />
        </Tabs>

        {inputMethod === 0 ? (
          <Paper
            {...getRootProps()}
            sx={{
              p: 4,
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
              border: '2px dashed',
              borderColor: isDragActive ? 'primary.main' : 'divider',
            }}
          >
            <input {...getInputProps()} />
            <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {isDragActive
                ? 'Drop the X-ray image here'
                : 'Drag and drop an X-ray image here, or click to select'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Supported formats: JPEG, JPG, PNG
            </Typography>
          </Paper>
        ) : (
          <Paper sx={{ p: 4 }}>
            <TextField
              fullWidth
              label="Image URL"
              variant="outlined"
              value={imageUrl}
              onChange={handleUrlChange}
              placeholder="Enter the URL of an X-ray image (e.g., https://example.com/xray.jpg)"
              sx={{ mb: 2 }}
            />
            <Typography variant="body2" color="text.secondary">
              Example URL: https://prod-images-static.radiopaedia.org/images/23511538/8a28003cc78f3549ac9f436dfe7dad_big_gallery.jpeg
            </Typography>
          </Paper>
        )}

        {(image || imageUrl) && (
          <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' } }}>
            <Box sx={{ flex: 1 }}>
              <Paper sx={{ p: 2, position: 'relative', height: { xs: '300px', md: '400px' } }}>
                <Image
                  src={image || imageUrl}
                  alt="X-ray"
                  fill
                  style={{ objectFit: 'contain' }}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </Paper>
              
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  onClick={generateReport}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <DescriptionIcon />}
                >
                  {loading ? 'Generating...' : 'Generate Report'}
                </Button>
              </Box>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Paper sx={{ p: 3, minHeight: '400px' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Report</Typography>
                  <Button
                    variant="outlined"
                    startIcon={<PrintIcon />}
                    onClick={handlePrint}
                    disabled={!report.findings && !report.impression && !report.view && Object.keys(report.sectionAnalysis).length === 0}
                  >
                    Print Report
                  </Button>
                </Box>

                {error && (
                  <Typography color="error" sx={{ mb: 2 }}>
                    {error}
                  </Typography>
                )}

                {report.view && (
                  <>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2 }}>View Classification</Typography>
                    <Typography>{report.view}</Typography>
                    <Divider sx={{ my: 2 }} />
                  </>
                )}

                {Object.keys(report.sectionAnalysis).length > 0 && (
                  <>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2 }}>Section Analysis</Typography>
                    <List dense>
                      {Object.entries(report.sectionAnalysis).map(([section, content]) => (
                        <ListItem key={section} sx={{ py: 0 }}>
                          <ListItemText
                            primary={section}
                            secondary={content}
                            primaryTypographyProps={{ fontWeight: 'bold' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                    <Divider sx={{ my: 2 }} />
                  </>
                )}

                {report.findings && (
                  <>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2 }}>Findings</Typography>
                    <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{report.findings}</Typography>
                    <Divider sx={{ my: 2 }} />
                  </>
                )}

                {report.impression && (
                  <>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2 }}>Impression</Typography>
                    <Typography>{report.impression}</Typography>
                  </>
                )}

                {!loading && !error && !report.findings && !report.impression && (
                  <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    {/* FIX: Replaced ' with &apos; to satisfy the linter */}
                    No report generated yet. Upload an image and click &apos;Generate Report&apos;.
                  </Typography>
                )}

                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                )}

              </Paper>
            </Box>
          </Box>
        )}
      </Box>
    </Container>
  );
}