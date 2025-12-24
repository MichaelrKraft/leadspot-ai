# LeadSpot AI - Mautic Plugin

This Mautic plugin adds an AI Command Center to your Mautic installation, allowing users to execute complex marketing tasks via natural language.

## Installation

### 1. Copy Plugin to Mautic

```bash
# Copy the plugin to your Mautic installation
scp -r LeadSpotBundle/ user@your-mautic-server:/path/to/mautic/plugins/

# For reddride.ploink.site:
scp -r LeadSpotBundle/ root@reddride.ploink.site:/var/www/mautic-redride/plugins/
```

### 2. Clear Mautic Cache

SSH into your Mautic server and run:

```bash
cd /path/to/mautic
php bin/console cache:clear
```

### 3. Install Plugin

1. Go to Mautic → Settings (gear icon) → Plugins
2. Click "Install/Upgrade Plugins"
3. You should see "LeadSpot AI" in the plugin list
4. Click on it and enable the plugin

### 4. Configure Backend URL

By default, the plugin connects to `http://localhost:8000`. To change this:

1. Edit `/path/to/mautic/plugins/LeadSpotBundle/Config/config.php`
2. Update the `leadspot_backend_url` parameter to your FastAPI backend URL

## Features

- **AI Command Center**: Accessible from Mautic's main menu
- **Natural Language Commands**: Execute marketing tasks by describing what you want
- **Real-time Chat Interface**: Modern chat UI that integrates with Mautic's design
- **Backend Integration**: Connects to LeadSpot FastAPI backend for AI processing

## Requirements

- Mautic 5.x or later
- PHP 8.0 or later
- LeadSpot FastAPI backend running and accessible

## Plugin Structure

```
LeadSpotBundle/
├── LeadSpotBundle.php           # Main bundle class
├── Config/
│   └── config.php               # Routes, menus, parameters
├── Controller/
│   └── CommandCenterController.php  # Main controller
├── Resources/
│   └── views/
│       └── CommandCenter/
│           └── index.html.twig  # Chat interface template
└── Assets/                      # Static assets (if needed)
```

**IMPORTANT**: Mautic requires views in `Resources/views/`, NOT `Views/`. The bundle name `LeadSpotBundle` maps to `@LeadSpot` template prefix.

## API Endpoints

The plugin creates these routes in Mautic:

- `GET /s/leadspot` - Main AI Command Center page
- `POST /s/leadspot/api/chat` - Proxy to backend chat API
- `GET /s/leadspot/settings` - Plugin settings

## Troubleshooting

### Plugin not appearing
- Clear Mautic cache: `php bin/console cache:clear`
- Check file permissions on the plugin directory
- Verify PHP version compatibility

### Connection errors
- Ensure the FastAPI backend is running
- Check the `leadspot_backend_url` configuration
- Verify CORS settings on the backend

### Menu not visible
- Clear browser cache
- Verify user has required permissions
- Check Mautic logs for errors

## Support

For issues or feature requests, please contact support@leadspot.ai
