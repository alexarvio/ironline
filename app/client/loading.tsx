// What a cold open of the client app shows while the page is drawn on the server (7 Nov, Alex): the opening's paper
// and star (OpeningSplash), streamed at once, so the phone shell's launch screen hands over to it. The page then draws
// the same screen over itself and spins it away once the app is ready.
import LoadingScreen from "./LoadingScreen";

// Not in the coach's phone preview (/client?phone=1, in a frame on the admin): it opens on the app, no opening.
const FRAMED = `try{if(window.self!==window.top)document.documentElement.classList.add("nc-framed")}catch(e){document.documentElement.classList.add("nc-framed")}`;

export default function Loading() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: FRAMED }} />
      <LoadingScreen />
    </>
  );
}
