"use client";
import { selectIsConnectedToRoom, useHMSActions, useHMSStore } from "@100mslive/react-sdk";
import Cookies from 'js-cookie';
import React from "react";
import { useEffect } from "react";
import CallFooter from "~/components/call-footer";
import Conference from "~/components/conference";
import ToastContext from "~/context/toast-context";
import { useParams, useRouter } from "next/navigation";
import { getSession } from "next-auth/react";
import { type RoomCodeResponse } from "~/types/room";
import { extractId } from "~/lib/extract-id";


export default function CallPage(){
    
    const params = useParams();
    const router = useRouter()
    const isConnected = useHMSStore(selectIsConnectedToRoom);
    const hmsActions = useHMSActions();
    const { addToast } = React.useContext(ToastContext);
    const actions = useHMSActions();
    const roomName = Cookies.get("room-name");
    const roomId = Cookies.get("room-id");
    const unAuthUsername = Cookies.get("username");
    
    useEffect(() => {

        async function joinCall(){
            
            if (!roomId) {
                console.error("Room id is not defined");
                return;
            }

            try {

                const roomCodeResponse = await fetch(`/api/call/code`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      callName: roomName ? roomName : params.slug,
                    }),
                })

                if(!roomCodeResponse?.ok){
    
                 // use room code to fetch auth token
                    const codeResponse: RoomCodeResponse = await roomCodeResponse.json() as RoomCodeResponse;
                    const roomCode = codeResponse.code;
                    const authToken = await hmsActions.getAuthTokenByRoomCode({ roomCode })
                    const session = await getSession();

                    if(session && session.user.name){
                        const userName = session.user.name;
                        await hmsActions.join({ userName, authToken });
                    } else if(!session && unAuthUsername){
                        await hmsActions.join({ userName: unAuthUsername, authToken });
                    }
                    else {
                        console.error("Session or user name is not defined");
                        addToast({
                            title: "Something went wrong.",
                            message: "This call cannot joined. Please try again.",
                            variant: "destructive",
                        });
                        router.replace("/calls");
                    }
                } else {
                    throw new Error("Room code response not OK");
                }

            } catch (error) {
                console.error(error)
                addToast({
                    title: "Something went wrong.",
                    message: "This call cannot be joined. Please try again.",
                    variant: "destructive",
                })
                router.replace("/calls");
            }
        }
        void joinCall();

    }, [hmsActions, addToast, params.slug, router, roomName, roomId, unAuthUsername]);

    useEffect(() => {
        window.onunload = () => {
            if (isConnected) {

                async function leaveCall() {
                    const response = await fetch(`/api/call/leave`, {
                      method: "PATCH",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        callName: roomName ? roomName : extractId(params.slug as string),
                        roomId: roomId,
                      }),
                    })
                
                    if(response.ok){
                      return addToast({
                        title: "Something went wrong.",
                        message: "Your call cannot be left. Please try again.",
                        variant: "destructive",
                      })
                    } 
                    
                    await actions.leave();
                }

                void leaveCall();
            }
        };

    }, [actions, addToast, hmsActions, isConnected, params.slug, roomId, roomName, router]);


    return(
        <section className="flex flex-col w-full h-screen overflow-hidden bg-neutral-950 text-gray-200">
            <Conference/>
            <CallFooter/>
        </section>

    )
}
