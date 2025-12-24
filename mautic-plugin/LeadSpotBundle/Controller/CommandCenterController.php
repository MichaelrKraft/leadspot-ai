<?php

namespace MauticPlugin\LeadSpotBundle\Controller;

use Mautic\CoreBundle\Controller\CommonController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * AI Command Center Controller
 *
 * Handles the main AI chat interface within Mautic.
 */
class CommandCenterController extends CommonController
{
    /**
     * Default backend URL - can be changed when deploying FastAPI backend
     */
    private const BACKEND_URL = 'http://localhost:8000';

    /**
     * Render the AI Command Center page
     */
    public function indexAction(): Response
    {
        return $this->delegateView([
            'viewParameters' => [
                'backendUrl' => self::BACKEND_URL,
                'mauticUrl'  => $this->generateUrl('mautic_core_ajax', [], true),
            ],
            'contentTemplate' => '@LeadSpot/CommandCenter/index.html.twig',
            'passthroughVars' => [
                'activeLink'    => '#leadspot_ai_menu',
                'mauticContent' => 'leadspot_command_center',
                'route'         => $this->generateUrl('leadspot_command_center'),
            ],
        ]);
    }

    /**
     * Proxy chat messages to LeadSpot backend
     */
    public function chatAction(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        try {
            // Forward request to LeadSpot backend
            $ch = curl_init(self::BACKEND_URL . '/api/chat');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode === 200) {
                return new JsonResponse(json_decode($response, true));
            }

            return new JsonResponse(['error' => 'Backend unavailable'], 503);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }
}
