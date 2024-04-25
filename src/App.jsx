import { useState, useEffect } from "react";
import { NFTStorage, File } from "nft.storage";
import { Buffer } from "buffer";
import { ethers } from "ethers";
import axios from "axios";

// Components
import Spinner from "react-bootstrap/Spinner";
import Navigation from "./components/Navigation";

// ABIs
import NFT from "./abis/NFT.json";

// Config
import config from "./config.json";

function App() {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null); // [variable , function that changes the value of that variable]
  const [nft, setNFT] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [url, setURL] = useState(null);
  const [isWaiting, setIsWaiting] = useState(null);
  const [message , setMessage] = useState("");

  const loadBlockchainData = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    setProvider(provider);

    const network = await provider.getNetwork(); // it gonna get the network that we are connected to from metamask
    const nft = new ethers.Contract(
      config[network.chainId].nft.address,
      NFT,
      provider
    );
    setNFT(nft);
  };

  const submitHandler = async (e) => {
    // e is event and preventDefault is there since default behaviour of a form in html is to do a new request
    // and if haven't put it down there the page will simply refresh
    // e.target.value --> the value that user provides
    e.preventDefault();

    if (name == "" || description == "") {
      window.alert("Please provide a name and a description");
      return;
    }

    setIsWaiting(true);

    // call ai api to generate an image based on description
    const imageData = createImage();

    // Upload image to ipfs (NFTStorage)
    const url = await uploadImage(imageData);

    // mint nft
    await mintImage(url);
    setIsWaiting(false);
    setMessage("");
  };

  const createImage = async () => {
    setMessage("Generating Image...");
    const URL = `https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2`;

    // send the request
    const response = axios({
      url: URL,
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.REACT_APP_HUGGING_FACE_API_KEY}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      data: JSON.stringify({
        inputs: description,
        options: { wait_for_model: true },
      }),
      responseType: "arraybuffer",
    });
    const type = response.headers["content-type"];
    const data = response.data;

    const base64data = Buffer.from(data).toString("base64");
    const img = `data:${type};base64,` + base64data; // this is so we can render it on the page
    setImage(img);

    return data;
  };

  const uploadImage = async (imageData) => {
    setMessage("Upload Image...");

    // using the nft storage software developer kit
    const nftStorage = new NFTStorage({
      token: process.env.REACT_APP_NFT_STORAGE_API_KEY,
    });

    // send request to store image
    const { ipnft } = await nftStorage.store({
      image: new File([imageData], "image.jpeg", { type: "image/jpeg" }),
      name: name,
      description: description,
    });

    // save the url
    const url = `https://ipfs.io/ipfs/${ipnft}/metadata.json`;
    setURL(url);
    return url;
  };

  const mintImage = async (tokenURI) => {
    setMessage("Waiting for mint")
    // first we need account connected to metamask
    const signer = await provider.getSigner();
    const transaction = await nft
      .connect(signer)
      .mint(tokenURI, { value: ethers.utils.parseUnits("1", "ether") });
    await transaction.wait();
  };

  useEffect(() => {
    loadBlockchainData();
  }, []);

  return (
    <div>
      <Navigation account={account} setAccount={setAccount} />

      <div className="form">
        <form onSubmit={submitHandler}>
          <input
            type="text"
            placeholder="Create a name..."
            onChange={(e) => {
              setName(e.target.value);
            }}
          ></input>
          <input
            type="text"
            placeholder="Create a description..."
            onChange={(e) => {
              setDescription(e.target.value);
            }}
          ></input>
          <input type="submit" value="Create & Mint"></input>
        </form>

        <div className="image">
          {!isWaiting && image ? (
            <img src={image} alt="ai_generated_image" />
          ) : isWaiting ? (
            <div className="image__placeholder">
              <Spinner animation="border" />
              <p>{message}</p>
            </div>
          ) :(
            <> </>
          )}
        </div>
      </div>
      {!isWaiting && url && (
        <p>
        View &nbsp;<a href={url} target="_blank" rel="noreferrer">Metadata</a>
        </p>
      )}
    </div>
  );
}

export default App;
// we will be using axios for making api request from this application
// POST request submits information to a server

// The ArrayBuffer object is used to represent a generic raw binary data buffer.
