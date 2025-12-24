<?php

return [
    'name'        => 'LeadSpot AI',
    'description' => 'AI Command Center for autonomous CRM agents. Execute complex marketing tasks via natural language.',
    'author'      => 'LeadSpot.ai',
    'version'     => '1.0.0',

    'routes' => [
        'main' => [
            'leadspot_command_center' => [
                'path'       => '/leadspot',
                'controller' => 'MauticPlugin\LeadSpotBundle\Controller\CommandCenterController::indexAction',
            ],
            'leadspot_chat_api' => [
                'path'       => '/leadspot/api/chat',
                'controller' => 'MauticPlugin\LeadSpotBundle\Controller\CommandCenterController::chatAction',
                'method'     => 'POST',
            ],
        ],
    ],

    'menu' => [
        'main' => [
            'priority' => 5,
            'items' => [
                'leadspot.command_center' => [
                    'id'        => 'leadspot_ai_menu',
                    'iconClass' => 'fa-robot',
                    'label'     => 'AI Command Center',
                    'route'     => 'leadspot_command_center',
                    'priority'  => 10,
                ],
            ],
        ],
    ],

    'parameters' => [
        'leadspot_backend_url'   => 'http://localhost:8000',
        'leadspot_anthropic_key' => '',
    ],
];
