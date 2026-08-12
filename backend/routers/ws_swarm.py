from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json

from backend.services.swarm_orchestrator import SwarmOrchestrator

router = APIRouter(tags=["swarm-ws"])

@router.websocket("/api/ws/swarm/run")
async def ws_run_swarm(websocket: WebSocket):
    """
    WebSocket endpoint that initiates the AI Swarm Orchestrator safety pipeline
    and streams progressive execution logs (JSON text frames) to the client.
    """
    await websocket.accept()
    orchestrator = SwarmOrchestrator()
    
    try:
        # Run pipeline limiting to 10 satellites for fast verification
        async for log_frame in orchestrator.run_pipeline(limit_sats=10):
            # Stream the progression log frame as JSON text
            await websocket.send_json(log_frame)
            
    except WebSocketDisconnect:
        print("WebSocket client disconnected from swarm execution.")
    except Exception as e:
        print(f"Error during Swarm WebSocket streaming: {e}")
        try:
            await websocket.send_json({
                "percentage": 100,
                "agent": "SYSTEM",
                "log": f"Execution interrupted by server error: {e}",
                "timestamp": ""
            })
        except Exception:
            pass
    finally:
        # Cleanly close the WebSocket connection if it remains open
        try:
            await websocket.close()
        except Exception:
            pass
